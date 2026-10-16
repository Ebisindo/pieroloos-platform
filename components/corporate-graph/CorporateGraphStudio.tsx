 "use client";
import { useEffect,useState } from "react";
import Link from "next/link";
type NodeRecord={id:string;name:string;nodeType:string;jurisdictionCode:string|null;entityType:string|null;clientId:string|null;createdAt:string};
type EdgeRecord={id:string;fromNodeId:string;toNodeId:string;relation:string;ownershipPercent:string|null;fromNode:{name:string};toNode:{name:string}};
type GraphData={nodes:NodeRecord[];edges:EdgeRecord[]};
const nodeTypes=["COMPANY","PERSON","TRUST","PARTNERSHIP","BRANCH","BANKING_RELATIONSHIP","LICENSE","TAX_REGISTRATION","OTHER"];
const relations=["OWNS","CONTROLS","SUBSIDIARY_OF","BRANCH_OF","BANKS_WITH","LICENSED_BY","TAX_REGISTERED_WITH","RELATED_TO"];
export default function CorporateGraphStudio(){
 const [graph,setGraph]=useState<GraphData>({nodes:[],edges:[]});
 const [name,setName]=useState(""); const [nodeType,setNodeType]=useState("COMPANY"); const [jurisdictionCode,setJurisdictionCode]=useState(""); const [entityType,setEntityType]=useState("COMPANY");
 const [fromNodeId,setFromNodeId]=useState(""); const [toNodeId,setToNodeId]=useState(""); const [relation,setRelation]=useState("OWNS"); const [ownershipPercent,setOwnershipPercent]=useState("");
 const [busy,setBusy]=useState(false); const [error,setError]=useState(""); const [message,setMessage]=useState("");
 async function refresh(){const response=await fetch("/api/corporate-graph",{cache:"no-store"});const payload=await response.json() as GraphData&{error?:string};if(!response.ok)throw new Error(payload.error??"Unable to load the corporate graph.");setGraph(payload);}
 useEffect(()=>{void refresh().catch((e:unknown)=>setError(e instanceof Error?e.message:"Unable to load graph."));},[]);
 async function createNode(event:React.FormEvent<HTMLFormElement>){event.preventDefault();setBusy(true);setError("");setMessage("");try{const response=await fetch("/api/corporate-graph/nodes",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({name,nodeType,jurisdictionCode:jurisdictionCode||undefined,entityType:entityType||undefined})});const payload=await response.json() as {error?:string};if(!response.ok)throw new Error(payload.error??"Unable to create entity.");setName("");setJurisdictionCode("");setMessage("Entity added to the workspace graph.");await refresh();}catch(e){setError(e instanceof Error?e.message:"Unable to create entity.");}finally{setBusy(false);}}
 async function createEdge(event:React.FormEvent<HTMLFormElement>){event.preventDefault();setBusy(true);setError("");setMessage("");try{const response=await fetch("/api/corporate-graph/edges",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({fromNodeId,toNodeId,relation,ownershipPercent:ownershipPercent===""?undefined:Number(ownershipPercent)})});const payload=await response.json() as {error?:string};if(!response.ok)throw new Error(payload.error??"Unable to create relationship.");setOwnershipPercent("");setMessage("Relationship added to the workspace graph.");await refresh();}catch(e){setError(e instanceof Error?e.message:"Unable to create relationship.");}finally{setBusy(false);}}
 return <main className="page-stack">
  <header className="page-header"><div><div className="eyebrow">PBOF · PIEROLOOS V2</div><h1>Corporate Graph Studio</h1><p>Map entities and relationships within the active workspace. Structures remain drafts until reviewed by appropriate professionals.</p></div><Link href="/command-center" className="button button-secondary">Command Centre</Link></header>
  <div className="metric-grid"><section className="glass-panel metric-card metric-gold"><div className="metric-label">Graph entities</div><div className="metric-value">{graph.nodes.length}</div><div className="metric-detail">Workspace-scoped nodes</div></section><section className="glass-panel metric-card metric-violet"><div className="metric-label">Relationships</div><div className="metric-value">{graph.edges.length}</div><div className="metric-detail">Ownership, control and other links</div></section><section className="glass-panel metric-card metric-cyan"><div className="metric-label">Governance status</div><div className="metric-value">Draft</div><div className="metric-detail">Human review required</div></section></div>
  {error?<p role="alert" className="graph-error">{error}</p>:null}{message?<p role="status" className="graph-success">{message}</p>:null}
  <div className="graph-grid">
   <section className="glass-panel"><div className="section-header"><div><h2>Add an entity</h2><p>Create a company, person or related corporate object.</p></div></div><form className="graph-form" onSubmit={createNode}>
    <label>Display name<input required minLength={2} maxLength={160} value={name} onChange={e=>setName(e.target.value)}/></label>
    <label>Node type<select value={nodeType} onChange={e=>setNodeType(e.target.value)}>{nodeTypes.map(value=><option key={value} value={value}>{value.replaceAll("_"," ")}</option>)}</select></label>
    <label>Jurisdiction code<input maxLength={8} placeholder="e.g. NG, GB, AE" value={jurisdictionCode} onChange={e=>setJurisdictionCode(e.target.value.toUpperCase())}/></label>
    <label>Entity type<input maxLength={80} value={entityType} onChange={e=>setEntityType(e.target.value)}/></label><button className="button button-primary" disabled={busy}>Add entity</button>
   </form></section>
   <section className="glass-panel"><div className="section-header"><div><h2>Connect entities</h2><p>Ownership and control links are checked for cycles.</p></div></div><form className="graph-form" onSubmit={createEdge}>
    <label>From entity<select required value={fromNodeId} onChange={e=>setFromNodeId(e.target.value)}><option value="">Choose entity</option>{graph.nodes.map(node=><option key={node.id} value={node.id}>{node.name}</option>)}</select></label>
    <label>Relationship<select value={relation} onChange={e=>setRelation(e.target.value)}>{relations.map(value=><option key={value} value={value}>{value.replaceAll("_"," ")}</option>)}</select></label>
    <label>To entity<select required value={toNodeId} onChange={e=>setToNodeId(e.target.value)}><option value="">Choose entity</option>{graph.nodes.map(node=><option key={node.id} value={node.id}>{node.name}</option>)}</select></label>
    <label>Ownership percentage (optional)<input type="number" min="0" max="100" step="0.01" value={ownershipPercent} onChange={e=>setOwnershipPercent(e.target.value)}/></label><button className="button button-primary" disabled={busy||graph.nodes.length<2}>Add relationship</button>
   </form></section>
  </div>
  <section className="glass-panel"><div className="section-header"><div><h2>Structure map</h2><p>Relationship inventory for the active workspace.</p></div></div>
   {graph.nodes.length===0?<p className="graph-empty">No entities yet. Add your first entity above.</p>:<div className="graph-node-list">{graph.nodes.map(node=><article className="graph-node" key={node.id}><div><strong>{node.name}</strong><p>{node.nodeType.replaceAll("_"," ")}{node.entityType?" · "+node.entityType:""}</p></div><span className="graph-tag">{node.jurisdictionCode??"Jurisdiction pending"}</span></article>)}</div>}
   {graph.edges.length>0?<div className="graph-edge-list"><h3>Relationships</h3>{graph.edges.map(edge=><p key={edge.id}><strong>{edge.fromNode.name}</strong> — <span>{edge.relation.replaceAll("_"," ")}</span> → <strong>{edge.toNode.name}</strong>{edge.ownershipPercent? ` (${edge.ownershipPercent}%)`:""}</p>)}</div>:null}
  </section><p className="graph-disclaimer">PieroloOS is decision-support software. It does not determine legal validity, tax treatment, banking eligibility or regulatory compliance. Confirm proposed structures with appropriately qualified professionals.</p>
 </main>;
}
