// src/App.tsx
// Pledge Auditor — main UI. Covers the full user journey:
//   browse pledges → register a pledge (stake) → trigger AI audit →
//   see the on-chain verdict + AI reason → reclaim stake / bounty payout.

import { useEffect, useState } from "react";
import {
  listPledges,
  getPledge,
  registerPledge,
  auditPledge,
  reclaimStake,
  VERDICT_LABEL,
  type PledgeSummary,
  type PledgeDetail,
} from "./genlayer";

const verdictColor: Record<number, string> = {
  0: "#888",
  1: "#1a7f37",
  2: "#cf222e",
  3: "#9a6700",
};

export default function App() {
  const [pledges, setPledges] = useState<PledgeSummary[]>([]);
  const [selected, setSelected] = useState<PledgeDetail | null>(null);
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<string>("");

  // register form
  const [form, setForm] = useState({
    id: "",
    orgName: "",
    description: "",
    evidenceUrl: "",
    stake: "1000",
  });

  async function refresh() {
    try {
      setPledges(await listPledges());
    } catch (e) {
      setStatus("Could not load pledges. Is the contract address set?");
    }
  }

  useEffect(() => {
    refresh();
  }, []);

  async function onRegister() {
    setLoading(true);
    setStatus("Registering pledge + staking on-chain…");
    try {
      await registerPledge({
        id: form.id.trim(),
        orgName: form.orgName.trim(),
        description: form.description.trim(),
        evidenceUrl: form.evidenceUrl.trim(),
        stake: BigInt(form.stake || "0"),
      });
      setStatus("Pledge registered ✓");
      setForm({ id: "", orgName: "", description: "", evidenceUrl: "", stake: "1000" });
      await refresh();
    } catch (e: any) {
      setStatus("Register failed: " + (e?.message ?? String(e)));
    } finally {
      setLoading(false);
    }
  }

  async function onAudit(id: string) {
    setLoading(true);
    setStatus(
      "Auditing on-chain… the AI jury is reading the evidence and reaching consensus. This can take a moment."
    );
    try {
      await auditPledge(id);
      const detail = await getPledge(id);
      setSelected(detail);
      setStatus(
        `Verdict: ${VERDICT_LABEL[detail.verdict]} — ${detail.last_reason}`
      );
      await refresh();
    } catch (e: any) {
      setStatus("Audit failed: " + (e?.message ?? String(e)));
    } finally {
      setLoading(false);
    }
  }

  async function onReclaim(id: string) {
    setLoading(true);
    setStatus("Reclaiming stake…");
    try {
      await reclaimStake(id);
      setStatus("Stake reclaimed ✓");
      await refresh();
      setSelected(await getPledge(id));
    } catch (e: any) {
      setStatus("Reclaim failed: " + (e?.message ?? String(e)));
    } finally {
      setLoading(false);
    }
  }

  async function onSelect(id: string) {
    setSelected(await getPledge(id));
  }

  return (
    <div style={{ fontFamily: "system-ui, sans-serif", maxWidth: 900, margin: "0 auto", padding: 24 }}>
      <header style={{ marginBottom: 24 }}>
        <h1 style={{ margin: 0 }}>🛡️ Pledge Auditor</h1>
        <p style={{ color: "#555", marginTop: 4 }}>
          A trustless reputation layer for public commitments. Organizations stake
          funds behind a promise; anyone can trigger an AI jury that reads live web
          evidence and judges whether the promise is kept. Breaches slash the stake
          into a whistleblower bounty.
        </p>
      </header>

      {status && (
        <div style={{ background: "#f4f4f4", padding: 12, borderRadius: 8, marginBottom: 16, fontSize: 14 }}>
          {loading ? "⏳ " : ""}
          {status}
        </div>
      )}

      <section style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 24 }}>
        {/* Register */}
        <div>
          <h2>Register a pledge</h2>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            <input placeholder="Unique id (e.g. acme-refund)" value={form.id}
              onChange={(e) => setForm({ ...form, id: e.target.value })} />
            <input placeholder="Organization name" value={form.orgName}
              onChange={(e) => setForm({ ...form, orgName: e.target.value })} />
            <textarea placeholder="The promise, in plain language" value={form.description} rows={3}
              onChange={(e) => setForm({ ...form, description: e.target.value })} />
            <input placeholder="Public evidence URL (https://…)" value={form.evidenceUrl}
              onChange={(e) => setForm({ ...form, evidenceUrl: e.target.value })} />
            <input placeholder="Stake amount" value={form.stake}
              onChange={(e) => setForm({ ...form, stake: e.target.value })} />
            <button disabled={loading} onClick={onRegister}>Stake &amp; register</button>
          </div>
        </div>

        {/* List */}
        <div>
          <h2>Pledges under audit</h2>
          {pledges.length === 0 && <p style={{ color: "#888" }}>No pledges yet.</p>}
          <ul style={{ listStyle: "none", padding: 0 }}>
            {pledges.map((p) => (
              <li key={p.id}
                style={{ border: "1px solid #e0e0e0", borderRadius: 8, padding: 12, marginBottom: 8, cursor: "pointer" }}
                onClick={() => onSelect(p.id)}>
                <div style={{ display: "flex", justifyContent: "space-between" }}>
                  <strong>{p.org_name}</strong>
                  <span style={{ color: verdictColor[p.verdict], fontWeight: 600 }}>
                    {VERDICT_LABEL[p.verdict]}
                  </span>
                </div>
                <div style={{ fontSize: 13, color: "#666" }}>
                  stake {p.stake} · bounty {p.bounty_pool}
                </div>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* Detail */}
      {selected && (
        <section style={{ marginTop: 24, border: "1px solid #e0e0e0", borderRadius: 12, padding: 20 }}>
          <h2 style={{ marginTop: 0 }}>{selected.org_name}</h2>
          <p><strong>Promise:</strong> {selected.description}</p>
          <p><strong>Evidence:</strong>{" "}
            <a href={selected.evidence_url} target="_blank" rel="noreferrer">{selected.evidence_url}</a>
          </p>
          <p>
            <strong>Verdict:</strong>{" "}
            <span style={{ color: verdictColor[selected.verdict], fontWeight: 700 }}>
              {VERDICT_LABEL[selected.verdict]}
            </span>{" "}
            · audits: {selected.audit_count}
          </p>
          {selected.last_reason && (
            <blockquote style={{ borderLeft: "3px solid #ccc", margin: 0, paddingLeft: 12, color: "#444" }}>
              AI reason: {selected.last_reason}
            </blockquote>
          )}
          <div style={{ marginTop: 12, display: "flex", gap: 8 }}>
            <button disabled={loading || selected.resolved} onClick={() => onAudit(selected.id)}>
              Trigger AI audit
            </button>
            <button disabled={loading || selected.verdict !== 1} onClick={() => onReclaim(selected.id)}>
              Reclaim stake (if Kept)
            </button>
          </div>
          {selected.resolved && <p style={{ color: "#cf222e", marginTop: 8 }}>This pledge is resolved.</p>}
        </section>
      )}

      <footer style={{ marginTop: 40, fontSize: 13, color: "#888" }}>
        Why GenLayer: reading unstructured public evidence and rendering a
        subjective "are they keeping their word?" verdict is impossible on a
        traditional smart-contract chain. The judgement <em>is</em> the product.
      </footer>
    </div>
  );
}
