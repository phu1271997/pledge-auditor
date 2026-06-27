// src/App.tsx
// Pledge Auditor — Premium Intelligent Contract Dashboard
// Implements full wallet connection (MetaMask) + gorgeous dark-theme glassmorphism.

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

const verdictColors: Record<number, { text: string; bg: string; border: string }> = {
  0: { text: "#9ca3af", bg: "rgba(156, 163, 175, 0.1)", border: "rgba(156, 163, 175, 0.2)" }, // Pending
  1: { text: "#10b981", bg: "rgba(16, 185, 129, 0.1)", border: "rgba(16, 185, 129, 0.2)" }, // Kept
  2: { text: "#f43f5e", bg: "rgba(244, 63, 94, 0.1)", border: "rgba(244, 63, 94, 0.2)" },  // Breached
  3: { text: "#f59e0b", bg: "rgba(245, 158, 11, 0.1)", border: "rgba(245, 158, 11, 0.2)" },  // Unclear
};

export default function App() {
  const [pledges, setPledges] = useState<PledgeSummary[]>([]);
  const [selected, setSelected] = useState<PledgeDetail | null>(null);
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<string>("");
  const [statusType, setStatusType] = useState<"info" | "success" | "error">("info");
  
  // Wallet state
  const [walletAddress, setWalletAddress] = useState<string | null>(null);

  // Register form
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
      showStatus("Could not load pledges. Verify contract address in .env", "error");
    }
  }

  function showStatus(msg: string, type: "info" | "success" | "error" = "info") {
    setStatus(msg);
    setStatusType(type);
  }

  // MetaMask integration
  useEffect(() => {
    refresh();

    if (typeof window !== "undefined" && (window as any).ethereum) {
      const eth = (window as any).ethereum;
      
      // Check if already connected
      eth.request({ method: "eth_accounts" })
        .then((accounts: string[]) => {
          if (accounts.length > 0) {
            setWalletAddress(accounts[0]);
          }
        })
        .catch(() => {});

      // Event listeners
      const handleAccounts = (accounts: string[]) => {
        if (accounts.length > 0) {
          setWalletAddress(accounts[0]);
          showStatus("Wallet switched ✓", "success");
        } else {
          setWalletAddress(null);
          showStatus("Wallet disconnected. Sandbox fallback active.", "info");
        }
      };

      eth.on("accountsChanged", handleAccounts);
      return () => {
        eth.removeListener("accountsChanged", handleAccounts);
      };
    }
  }, []);

  async function connectWallet() {
    if (typeof window !== "undefined" && (window as any).ethereum) {
      setLoading(true);
      showStatus("Connecting to MetaMask…", "info");
      try {
        const accounts = await (window as any).ethereum.request({
          method: "eth_requestAccounts",
        });
        if (accounts.length > 0) {
          setWalletAddress(accounts[0]);
          showStatus("Wallet connected ✓", "success");
        }
      } catch (e: any) {
        showStatus("Connection failed: " + (e?.message ?? String(e)), "error");
      } finally {
        setLoading(false);
      }
    } else {
      showStatus("MetaMask extension not detected. Running in Sandbox Mode.", "error");
    }
  }

  function disconnectWallet() {
    setWalletAddress(null);
    showStatus("Disconnected. Sandbox mode active.", "info");
  }

  async function onRegister() {
    if (!form.id.trim() || !form.orgName.trim() || !form.description.trim() || !form.evidenceUrl.trim()) {
      showStatus("All fields are required", "error");
      return;
    }
    setLoading(true);
    showStatus("Registering pledge + staking funds on-chain…", "info");
    try {
      await registerPledge(
        {
          id: form.id.trim(),
          orgName: form.orgName.trim(),
          description: form.description.trim(),
          evidenceUrl: form.evidenceUrl.trim(),
          stake: BigInt(form.stake || "0"),
        },
        walletAddress || undefined
      );
      showStatus("Pledge successfully registered ✓", "success");
      setForm({ id: "", orgName: "", description: "", evidenceUrl: "", stake: "1000" });
      await refresh();
    } catch (e: any) {
      showStatus("Registration failed: " + (e?.message ?? String(e)), "error");
    } finally {
      setLoading(false);
    }
  }

  async function onAudit(id: string) {
    setLoading(true);
    showStatus("Jury Consensus: Validators are running non-deterministic audits on the evidence URL…", "info");
    try {
      await auditPledge(id, walletAddress || undefined);
      const detail = await getPledge(id);
      setSelected(detail);
      showStatus(`Audit complete! Verdict: ${VERDICT_LABEL[detail.verdict]} ✓`, "success");
      await refresh();
    } catch (e: any) {
      showStatus("Audit failed: " + (e?.message ?? String(e)), "error");
    } finally {
      setLoading(false);
    }
  }

  async function onReclaim(id: string) {
    setLoading(true);
    showStatus("Sending reclaim transaction…", "info");
    try {
      await reclaimStake(id, walletAddress || undefined);
      showStatus("Stake successfully reclaimed ✓", "success");
      await refresh();
      setSelected(await getPledge(id));
    } catch (e: any) {
      showStatus("Reclaim failed: " + (e?.message ?? String(e)), "error");
    } finally {
      setLoading(false);
    }
  }

  async function onSelect(id: string) {
    setLoading(true);
    try {
      setSelected(await getPledge(id));
    } catch (e) {
      showStatus("Failed to fetch pledge details.", "error");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{
      minHeight: "100vh",
      background: "radial-gradient(circle at top right, #111827 0%, #030712 100%)",
      fontFamily: "'Inter', system-ui, sans-serif",
      color: "#f3f4f6",
      padding: "32px 16px"
    }}>
      <div style={{ maxWidth: 1100, margin: "0 auto" }}>
        
        {/* Header Section */}
        <header style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          flexWrap: "wrap",
          gap: 20,
          marginBottom: 32,
          paddingBottom: 24,
          borderBottom: "1px solid rgba(255, 255, 255, 0.08)"
        }}>
          <div>
            <h1 style={{
              margin: 0,
              fontSize: "2.2rem",
              fontFamily: "'Outfit', sans-serif",
              fontWeight: 800,
              background: "linear-gradient(135deg, #a78bfa 0%, #6366f1 100%)",
              WebkitBackgroundClip: "text",
              WebkitTextFillColor: "transparent"
            }}>
              🛡️ Pledge Auditor
            </h1>
            <p style={{ color: "#9ca3af", margin: "6px 0 0 0", fontSize: 15 }}>
              Decentralized subjective reputation layer on <strong style={{ color: "#c084fc" }}>GenLayer</strong>
            </p>
          </div>

          {/* Connection Area */}
          <div style={{
            background: "rgba(31, 41, 55, 0.4)",
            backdropFilter: "blur(8px)",
            border: "1px solid rgba(255, 255, 255, 0.08)",
            borderRadius: 16,
            padding: "12px 18px",
            display: "flex",
            alignItems: "center",
            gap: 16
          }}>
            {walletAddress ? (
              <>
                <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    <span style={{ width: 8, height: 8, borderRadius: "50%", background: "#10b981" }} />
                    <span style={{ fontSize: 13, color: "#9ca3af" }}>Connected</span>
                  </div>
                  <strong style={{ fontSize: 14, color: "#e5e7eb", fontFamily: "monospace" }}>
                    {walletAddress.slice(0, 6)}...{walletAddress.slice(-4)}
                  </strong>
                </div>
                <button
                  onClick={disconnectWallet}
                  style={{
                    background: "rgba(239, 68, 68, 0.15)",
                    border: "1px solid rgba(239, 68, 68, 0.3)",
                    color: "#f87171",
                    borderRadius: 10,
                    padding: "6px 12px",
                    cursor: "pointer",
                    fontSize: 13,
                    fontWeight: 500,
                    transition: "all 0.2s"
                  }}>
                  Disconnect
                </button>
              </>
            ) : (
              <>
                <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    <span style={{ width: 8, height: 8, borderRadius: "50%", background: "#f59e0b" }} />
                    <span style={{ fontSize: 13, color: "#9ca3af" }}>Sandbox Mode</span>
                  </div>
                  <span style={{ fontSize: 12, color: "#6b7280" }}>Using local sandbox key</span>
                </div>
                <button
                  disabled={loading}
                  onClick={connectWallet}
                  style={{
                    background: "linear-gradient(135deg, #6366f1 0%, #4f46e5 100%)",
                    border: "none",
                    color: "white",
                    borderRadius: 12,
                    padding: "10px 18px",
                    cursor: "pointer",
                    fontSize: 14,
                    fontWeight: 600,
                    boxShadow: "0 4px 14px rgba(79, 70, 229, 0.4)",
                    transition: "all 0.2s"
                  }}>
                  🔌 Connect Wallet
                </button>
              </>
            )}
          </div>
        </header>

        {/* Global Notification Banner */}
        {status && (
          <div style={{
            background: statusType === "success" 
              ? "rgba(16, 185, 129, 0.12)" 
              : statusType === "error" 
                ? "rgba(239, 68, 68, 0.12)" 
                : "rgba(31, 41, 55, 0.6)",
            border: `1px solid ${
              statusType === "success" 
                ? "rgba(16, 185, 129, 0.3)" 
                : statusType === "error" 
                  ? "rgba(239, 68, 68, 0.3)" 
                  : "rgba(255, 255, 255, 0.08)"
            }`,
            color: statusType === "success" 
              ? "#34d399" 
              : statusType === "error" 
                ? "#f87171" 
                : "#e5e7eb",
            padding: 16,
            borderRadius: 14,
            marginBottom: 24,
            fontSize: 14.5,
            display: "flex",
            alignItems: "center",
            gap: 12
          }}>
            <span style={{ fontSize: 18 }}>
              {loading ? "⏳" : statusType === "success" ? "✅" : statusType === "error" ? "❌" : "ℹ️"}
            </span>
            <div style={{ flex: 1 }}>{status}</div>
            {loading && <div className="spinner" style={{
              width: 14,
              height: 14,
              border: "2px solid rgba(255,255,255,0.2)",
              borderTop: "2px solid white",
              borderRadius: "50%",
              animation: "spin 1s linear infinite"
            }} />}
          </div>
        )}

        {/* Style block for micro-animations */}
        <style dangerouslySetInnerHTML={{__html: `
          @keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
          input:focus, textarea:focus {
            outline: none;
            border-color: #818cf8 !important;
            box-shadow: 0 0 0 3px rgba(129, 140, 248, 0.2);
          }
          .glass-panel {
            background: rgba(17, 24, 39, 0.55);
            backdrop-filter: blur(12px);
            border: 1px solid rgba(255, 255, 255, 0.08);
            box-shadow: 0 10px 30px rgba(0, 0, 0, 0.2);
            border-radius: 20px;
            padding: 24px;
            transition: all 0.3s;
          }
          .list-item {
            background: rgba(31, 41, 55, 0.3);
            border: 1px solid rgba(255, 255, 255, 0.05);
            border-radius: 14px;
            padding: 16px;
            margin-bottom: 12px;
            cursor: pointer;
            transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
          }
          .list-item:hover {
            background: rgba(31, 41, 55, 0.5);
            transform: translateY(-2px);
            border-color: rgba(255, 255, 255, 0.15);
            box-shadow: 0 4px 20px rgba(0,0,0,0.15);
          }
          .form-btn {
            background: linear-gradient(135deg, #6366f1 0%, #4f46e5 100%);
            border: none;
            color: white;
            font-weight: 600;
            padding: 12px;
            border-radius: 12px;
            cursor: pointer;
            box-shadow: 0 4px 12px rgba(79, 70, 229, 0.3);
            transition: all 0.2s;
          }
          .form-btn:hover:not(:disabled) {
            transform: translateY(-1px);
            box-shadow: 0 6px 16px rgba(79, 70, 229, 0.4);
          }
          .form-btn:active:not(:disabled) {
            transform: translateY(1px);
          }
          .sec-btn {
            background: rgba(255, 255, 255, 0.05);
            border: 1px solid rgba(255, 255, 255, 0.1);
            color: #e5e7eb;
            font-weight: 600;
            padding: 12px 20px;
            border-radius: 12px;
            cursor: pointer;
            transition: all 0.2s;
          }
          .sec-btn:hover:not(:disabled) {
            background: rgba(255, 255, 255, 0.1);
            border-color: rgba(255, 255, 255, 0.2);
          }
        `}} />

        {/* Dashboard Grid */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(350px, 1fr))", gap: 24, marginBottom: 32 }}>
          
          {/* Register Panel */}
          <div className="glass-panel">
            <h2 style={{ margin: "0 0 16px 0", fontSize: "1.4rem", fontFamily: "'Outfit', sans-serif" }}>
              📢 Register New Pledge
            </h2>
            <p style={{ fontSize: 13.5, color: "#9ca3af", marginBottom: 20 }}>
              Back your qualitiative pledge with staked funds. Anyone can audit it later.
            </p>
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <div>
                <label style={{ fontSize: 12, color: "#9ca3af", display: "block", marginBottom: 6, fontWeight: 500 }}>Pledge ID (unique slug)</label>
                <input
                  style={{
                    background: "rgba(17, 24, 39, 0.6)",
                    border: "1px solid rgba(255, 255, 255, 0.1)",
                    borderRadius: 10,
                    padding: "10px 12px",
                    color: "white",
                    width: "100%",
                    boxSizing: "border-box",
                    fontSize: 14
                  }}
                  placeholder="e.g. acme-carbon-neutral"
                  value={form.id}
                  onChange={(e) => setForm({ ...form, id: e.target.value })}
                />
              </div>

              <div>
                <label style={{ fontSize: 12, color: "#9ca3af", display: "block", marginBottom: 6, fontWeight: 500 }}>Organization Name</label>
                <input
                  style={{
                    background: "rgba(17, 24, 39, 0.6)",
                    border: "1px solid rgba(255, 255, 255, 0.1)",
                    borderRadius: 10,
                    padding: "10px 12px",
                    color: "white",
                    width: "100%",
                    boxSizing: "border-box",
                    fontSize: 14
                  }}
                  placeholder="e.g. Acme Corp"
                  value={form.orgName}
                  onChange={(e) => setForm({ ...form, orgName: e.target.value })}
                />
              </div>

              <div>
                <label style={{ fontSize: 12, color: "#9ca3af", display: "block", marginBottom: 6, fontWeight: 500 }}>Pledge Promise Statement</label>
                <textarea
                  style={{
                    background: "rgba(17, 24, 39, 0.6)",
                    border: "1px solid rgba(255, 255, 255, 0.1)",
                    borderRadius: 10,
                    padding: "10px 12px",
                    color: "white",
                    width: "100%",
                    boxSizing: "border-box",
                    fontFamily: "inherit",
                    fontSize: 14,
                    resize: "vertical"
                  }}
                  rows={3}
                  placeholder="Describe your commitment in detail..."
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                />
              </div>

              <div>
                <label style={{ fontSize: 12, color: "#9ca3af", display: "block", marginBottom: 6, fontWeight: 500 }}>Evidence URL (Public Website)</label>
                <input
                  style={{
                    background: "rgba(17, 24, 39, 0.6)",
                    border: "1px solid rgba(255, 255, 255, 0.1)",
                    borderRadius: 10,
                    padding: "10px 12px",
                    color: "white",
                    width: "100%",
                    boxSizing: "border-box",
                    fontSize: 14
                  }}
                  placeholder="https://acme.org/policy"
                  value={form.evidenceUrl}
                  onChange={(e) => setForm({ ...form, evidenceUrl: e.target.value })}
                />
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, alignItems: "flex-end" }}>
                <div>
                  <label style={{ fontSize: 12, color: "#9ca3af", display: "block", marginBottom: 6, fontWeight: 500 }}>Stake (GEN Tokens)</label>
                  <input
                    style={{
                      background: "rgba(17, 24, 39, 0.6)",
                      border: "1px solid rgba(255, 255, 255, 0.1)",
                      borderRadius: 10,
                      padding: "10px 12px",
                      color: "white",
                      width: "100%",
                      boxSizing: "border-box",
                      fontSize: 14
                    }}
                    type="number"
                    placeholder="1000"
                    value={form.stake}
                    onChange={(e) => setForm({ ...form, stake: e.target.value })}
                  />
                </div>
                <button
                  className="form-btn"
                  disabled={loading}
                  onClick={onRegister}
                  style={{ height: 41 }}>
                  Stake &amp; Register
                </button>
              </div>
            </div>
          </div>

          {/* List Panel */}
          <div className="glass-panel" style={{ display: "flex", flexDirection: "column" }}>
            <h2 style={{ margin: "0 0 16px 0", fontSize: "1.4rem", fontFamily: "'Outfit', sans-serif" }}>
              🔍 Active Pledges
            </h2>
            {pledges.length === 0 ? (
              <div style={{
                flex: 1,
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                color: "#6b7280",
                gap: 12,
                padding: "40px 0"
              }}>
                <span style={{ fontSize: 32 }}>📁</span>
                <span>No pledges registered yet.</span>
              </div>
            ) : (
              <div style={{ flex: 1, overflowY: "auto", maxHeight: 440 }}>
                {pledges.map((p) => {
                  const style = verdictColors[p.verdict] || verdictColors[0];
                  return (
                    <div
                      key={p.id}
                      className="list-item"
                      onClick={() => onSelect(p.id)}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 8 }}>
                        <span style={{ fontSize: 13, color: "#818cf8", fontWeight: 600 }}>{p.id}</span>
                        <span style={{
                          fontSize: 11.5,
                          fontWeight: 700,
                          color: style.text,
                          background: style.bg,
                          border: `1px solid ${style.border}`,
                          borderRadius: 8,
                          padding: "2px 8px",
                          textTransform: "uppercase"
                        }}>
                          {VERDICT_LABEL[p.verdict]}
                        </span>
                      </div>
                      <div style={{ fontWeight: 600, fontSize: 16, color: "#f3f4f6", marginBottom: 6 }}>
                        {p.org_name}
                      </div>
                      <div style={{ display: "flex", gap: 12, fontSize: 13, color: "#9ca3af" }}>
                        <div>Stake: <strong style={{ color: "#d1d5db" }}>{p.stake} GEN</strong></div>
                        <div>Pool: <strong style={{ color: "#d1d5db" }}>{p.bounty_pool} GEN</strong></div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

        </div>

        {/* Selected Pledge Detail Section */}
        {selected ? (
          <section className="glass-panel" style={{
            background: "rgba(17, 24, 39, 0.7)",
            border: "1px solid rgba(139, 92, 246, 0.15)",
            boxShadow: "0 10px 40px rgba(139, 92, 246, 0.05)"
          }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "1px solid rgba(255,255,255,0.06)", paddingBottom: 16, marginBottom: 20 }}>
              <h2 style={{ margin: 0, fontFamily: "'Outfit', sans-serif", fontSize: "1.7rem" }}>
                {selected.org_name}
              </h2>
              <span style={{
                fontSize: 12.5,
                fontWeight: 700,
                color: (verdictColors[selected.verdict] || verdictColors[0]).text,
                background: (verdictColors[selected.verdict] || verdictColors[0]).bg,
                border: `1px solid ${(verdictColors[selected.verdict] || verdictColors[0]).border}`,
                borderRadius: 8,
                padding: "3px 12px",
                textTransform: "uppercase"
              }}>
                {VERDICT_LABEL[selected.verdict]}
              </span>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 20, marginBottom: 20 }}>
              <div>
                <span style={{ fontSize: 12, color: "#9ca3af", display: "block", marginBottom: 4 }}>Promise:</span>
                <p style={{ margin: 0, fontSize: 15, lineHeight: 1.5, color: "#e5e7eb" }}>{selected.description}</p>
              </div>

              <div>
                <span style={{ fontSize: 12, color: "#9ca3af", display: "block", marginBottom: 4 }}>Evidence Source:</span>
                <a
                  href={selected.evidence_url}
                  target="_blank"
                  rel="noreferrer"
                  style={{ color: "#c084fc", textDecoration: "none", wordBreak: "break-all", fontSize: 14.5, fontWeight: 500 }}>
                  🔗 {selected.evidence_url}
                </a>
              </div>
            </div>

            <div style={{ display: "flex", flexWrap: "wrap", gap: 24, background: "rgba(255,255,255,0.02)", padding: "16px 20px", borderRadius: 14, marginBottom: 20, border: "1px solid rgba(255,255,255,0.04)" }}>
              <div>
                <span style={{ fontSize: 12, color: "#9ca3af", display: "block", marginBottom: 2 }}>Current Stake</span>
                <strong style={{ fontSize: "1.3rem", color: "#f3f4f6" }}>{selected.stake} GEN</strong>
              </div>
              <div>
                <span style={{ fontSize: 12, color: "#9ca3af", display: "block", marginBottom: 2 }}>Bounty Pool</span>
                <strong style={{ fontSize: "1.3rem", color: "#f3f4f6" }}>{selected.bounty_pool} GEN</strong>
              </div>
              <div>
                <span style={{ fontSize: 12, color: "#9ca3af", display: "block", marginBottom: 2 }}>Jury Audits</span>
                <strong style={{ fontSize: "1.3rem", color: "#f3f4f6" }}>{selected.audit_count}</strong>
              </div>
              <div style={{ flex: 1, textAlign: "right" }}>
                <span style={{ fontSize: 12, color: "#9ca3af", display: "block", marginBottom: 2 }}>Pledge Creator</span>
                <span style={{ fontSize: 13, fontFamily: "monospace", color: "#9ca3af" }}>{selected.creator}</span>
              </div>
            </div>

            {selected.last_reason && (
              <div style={{
                background: "rgba(31, 41, 55, 0.4)",
                borderLeft: `4px solid ${(verdictColors[selected.verdict] || verdictColors[0]).text}`,
                padding: "16px 20px",
                borderRadius: "0 14px 14px 0",
                marginBottom: 24
              }}>
                <span style={{ fontSize: 12.5, fontWeight: 600, color: "#818cf8", display: "block", marginBottom: 4 }}>Last AI Jury Verdict Justification:</span>
                <p style={{ margin: 0, fontSize: 14.5, fontStyle: "italic", lineHeight: 1.5, color: "#d1d5db" }}>
                  "{selected.last_reason}"
                </p>
              </div>
            )}

            <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
              <button
                className="form-btn"
                disabled={loading || selected.resolved}
                onClick={() => onAudit(selected.id)}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  background: selected.resolved ? "#4b5563" : "linear-gradient(135deg, #8b5cf6 0%, #6d28d9 100%)",
                  boxShadow: selected.resolved ? "none" : "0 4px 12px rgba(139, 92, 246, 0.3)"
                }}>
                🤖 Trigger AI Audit
              </button>

              <button
                className="sec-btn"
                disabled={loading || selected.verdict !== 1 || selected.resolved}
                onClick={() => onReclaim(selected.id)}>
                💰 Reclaim Stake (Creator-only)
              </button>
            </div>
            {selected.resolved && (
              <p style={{ color: "#f43f5e", marginTop: 12, fontSize: 13.5, fontWeight: 500 }}>
                ⚠️ This pledge is resolved and closed. Bounty pool has been processed.
              </p>
            )}
          </section>
        ) : (
          <div className="glass-panel" style={{ textAlign: "center", padding: "40px 20px", color: "#6b7280" }}>
            <span>Select an active pledge from the list to audit or review transaction metrics.</span>
          </div>
        )}

        {/* Footer */}
        <footer style={{
          marginTop: 48,
          paddingTop: 24,
          borderTop: "1px solid rgba(255, 255, 255, 0.08)",
          fontSize: 13,
          color: "#4b5563",
          lineHeight: 1.6,
          textAlign: "center"
        }}>
          💡 <strong>Consensus Mechanism:</strong> The AI jury consensus runs on-chain via the <em>Equivalence Principle</em>. 
          Validators execute non-deterministic LLM evaluation of the crawled evidence page to reach agreement. 
          True subjective evaluation on a decentralized layer is only possible on GenLayer.
        </footer>

      </div>
    </div>
  );
}
