// src/genlayer.ts
// Thin wrapper around genlayer-js for the Pledge Auditor dApp.
// All reads/writes go to the REAL deployed Pledge Auditor Intelligent Contract.
//
// IMPORTANT: Do NOT point this client at the SLA Auto-Enforcer contract.
// The live misconfiguration that failed review baked in the SLA address
// 0x4452EBa2A88F8e3708193253A6aDFC11B82366FC (create_agreement / settle methods).

import {
  createClient,
  createAccount,
  generatePrivateKey,
} from "genlayer-js";
import { studionet } from "genlayer-js/chains";
import { type Address, TransactionStatus } from "genlayer-js/types";

/** Known-wrong address previously shipped on pledge-auditor.vercel.app */
export const FORBIDDEN_SLA_ADDRESS =
  "0x4452EBa2A88F8e3708193253A6aDFC11B82366FC".toLowerCase();

/** Methods that MUST exist on the bound contract (Pledge Auditor only). */
export const EXPECTED_METHODS = [
  "register_pledge",
  "audit_pledge",
  "reclaim_stake",
  "get_pledge",
  "list_pledges",
] as const;

/** Methods that indicate the SLA Auto-Enforcer was wired by mistake. */
export const SLA_METHODS = [
  "create_agreement",
  "settle",
  "list_agreements",
  "get_agreement",
] as const;

const ZERO = "0x0000000000000000000000000000000000000000";

// Prefer env (Vercel / .env). No silent fallback to the SLA address — ever.
const rawAddress = String(
  (import.meta as any).env?.VITE_CONTRACT_ADDRESS ?? ""
).trim();

const rawRpc = String(
  (import.meta as any).env?.VITE_GENLAYER_RPC ?? "https://studio.genlayer.com/api"
).trim();

export const CONTRACT_ADDRESS = (rawAddress || ZERO) as Address;
export const RPC_URL = rawRpc || "https://studio.genlayer.com/api";

// Verdict codes mirror the contract's VERDICT_* constants.
export const VERDICT = {
  PENDING: 0,
  KEPT: 1,
  BREACHED: 2,
  UNCLEAR: 3,
} as const;

export const VERDICT_LABEL: Record<number, string> = {
  0: "Pending",
  1: "Kept",
  2: "Breached",
  3: "Unclear",
};

export const config = {
  product: "Pledge Auditor",
  contractAddress: CONTRACT_ADDRESS,
  rpcUrl: RPC_URL,
  networkKey: "studionet" as const,
  networkLabel: "GenLayer Studionet",
  sourcePath: "contracts/pledge_auditor.py",
  githubRepo: "https://github.com/phu1271997/pledge-auditor",
  liveApp: "https://pledge-auditor.vercel.app",
  explorerUrl: CONTRACT_ADDRESS && CONTRACT_ADDRESS !== ZERO
    ? `https://explorer-studio.genlayer.com/address/${CONTRACT_ADDRESS}`
    : "",
  studioUrl: "https://studio.genlayer.com/run-debug",
  expectedMethods: EXPECTED_METHODS as readonly string[],
  isConfigured:
    Boolean(rawAddress) &&
    rawAddress.toLowerCase() !== ZERO.toLowerCase() &&
    rawAddress.toLowerCase() !== FORBIDDEN_SLA_ADDRESS,
};

function assertPledgeBinding() {
  if (!rawAddress || rawAddress.toLowerCase() === ZERO.toLowerCase()) {
    throw new Error(
      "VITE_CONTRACT_ADDRESS is not set. Deploy contracts/pledge_auditor.py and set the address on Vercel / .env."
    );
  }
  if (rawAddress.toLowerCase() === FORBIDDEN_SLA_ADDRESS) {
    throw new Error(
      "Misconfigured: VITE_CONTRACT_ADDRESS points at the SLA Auto-Enforcer contract " +
        `(${rawAddress}). Set it to the deployed Pledge Auditor address from contracts/pledge_auditor.py instead.`
    );
  }
  if (!rawAddress.startsWith("0x") || rawAddress.length !== 42) {
    throw new Error(`Invalid VITE_CONTRACT_ADDRESS: ${rawAddress}`);
  }
}

function getAccount() {
  // Demo/testnet: derive a local key (persisted) so users can transact without
  // a wallet. Prefer MetaMask when the UI passes walletAddress.
  let pk = localStorage.getItem("pa_pk");
  if (!pk) {
    pk = generatePrivateKey();
    localStorage.setItem("pa_pk", pk);
  }
  return createAccount(pk as `0x${string}`);
}

export function getClient(walletAddress?: string) {
  assertPledgeBinding();

  if (walletAddress && typeof window !== "undefined" && (window as any).ethereum) {
    return createClient({
      chain: studionet,
      endpoint: RPC_URL,
      provider: (window as any).ethereum,
      account: walletAddress as Address,
    });
  }
  return createClient({
    chain: studionet,
    endpoint: RPC_URL,
    account: getAccount(),
  });
}

export interface PledgeSummary {
  id: string;
  org_name: string;
  verdict: number;
  stake: string;
  bounty_pool: string;
  resolved: boolean;
}

export interface PledgeDetail extends PledgeSummary {
  description: string;
  evidence_url: string;
  creator: string;
  last_reason: string;
  audit_count: string;
}

function normalizeError(error: unknown): string {
  if (error instanceof Error) return error.message;
  return String(error);
}

function methodMismatchHint(error: unknown): string {
  const msg = normalizeError(error).toLowerCase();
  if (
    msg.includes("create_agreement") ||
    msg.includes("list_agreements") ||
    msg.includes("unknown method") ||
    msg.includes("not found") ||
    msg.includes("has no attribute")
  ) {
    return (
      " Contract methods do not match Pledge Auditor " +
      `(expected: ${EXPECTED_METHODS.join(", ")}). ` +
      "If this address is the SLA Auto-Enforcer, redeploy contracts/pledge_auditor.py and update VITE_CONTRACT_ADDRESS."
    );
  }
  return "";
}

/** Public health check — list_pledges must succeed on a real Pledge Auditor. */
export async function healthCheck(): Promise<{
  ok: boolean;
  message: string;
  pledgeCount?: number;
}> {
  try {
    assertPledgeBinding();
    const list = await listPledges();
    return {
      ok: true,
      message: `Bound to Pledge Auditor · list_pledges() OK · ${list.length} pledge(s)`,
      pledgeCount: list.length,
    };
  } catch (error) {
    return {
      ok: false,
      message: normalizeError(error) + methodMismatchHint(error),
    };
  }
}

export async function listPledges(): Promise<PledgeSummary[]> {
  const client = getClient();
  try {
    const raw = await client.readContract({
      address: CONTRACT_ADDRESS,
      functionName: "list_pledges",
      args: [],
    });
    const parsed = JSON.parse(raw as string);
    if (!Array.isArray(parsed)) {
      throw new Error("list_pledges did not return a JSON array — wrong contract?");
    }
    return parsed as PledgeSummary[];
  } catch (error) {
    throw new Error(normalizeError(error) + methodMismatchHint(error));
  }
}

export async function getPledge(id: string): Promise<PledgeDetail> {
  const client = getClient();
  try {
    const raw = await client.readContract({
      address: CONTRACT_ADDRESS,
      functionName: "get_pledge",
      args: [id],
    });
    const parsed = JSON.parse(raw as string) as Partial<PledgeDetail>;
    // Contract storage may omit id; always inject the requested id for the UI.
    return {
      id,
      org_name: String(parsed.org_name ?? ""),
      description: String(parsed.description ?? ""),
      evidence_url: String(parsed.evidence_url ?? ""),
      creator: String(parsed.creator ?? ""),
      stake: String(parsed.stake ?? "0"),
      bounty_pool: String(parsed.bounty_pool ?? "0"),
      verdict: Number(parsed.verdict ?? 0),
      last_reason: String(parsed.last_reason ?? ""),
      audit_count: String(parsed.audit_count ?? "0"),
      resolved: Boolean(parsed.resolved),
    };
  } catch (error) {
    throw new Error(normalizeError(error) + methodMismatchHint(error));
  }
}

export async function registerPledge(
  params: {
    id: string;
    orgName: string;
    description: string;
    evidenceUrl: string;
    stake: bigint;
  },
  walletAddress?: string
): Promise<string> {
  const client = getClient(walletAddress);
  try {
    const txHash = await client.writeContract({
      address: CONTRACT_ADDRESS,
      functionName: "register_pledge",
      args: [params.id, params.orgName, params.description, params.evidenceUrl],
      value: params.stake,
    });
    await client.waitForTransactionReceipt({
      hash: txHash,
      status: TransactionStatus.FINALIZED,
    });
    return txHash as string;
  } catch (error) {
    throw new Error(normalizeError(error) + methodMismatchHint(error));
  }
}

// Trigger an on-chain audit. Fires the AI jury: contract reads the evidence URL
// and validators reach consensus on the verdict (slower than a normal tx).
export async function auditPledge(id: string, walletAddress?: string): Promise<string> {
  const client = getClient(walletAddress);
  try {
    const txHash = await client.writeContract({
      address: CONTRACT_ADDRESS,
      functionName: "audit_pledge",
      args: [id],
      value: 0n,
    });
    await client.waitForTransactionReceipt({
      hash: txHash,
      status: TransactionStatus.FINALIZED,
    });
    return txHash as string;
  } catch (error) {
    throw new Error(normalizeError(error) + methodMismatchHint(error));
  }
}

export async function reclaimStake(id: string, walletAddress?: string): Promise<string> {
  const client = getClient(walletAddress);
  try {
    const txHash = await client.writeContract({
      address: CONTRACT_ADDRESS,
      functionName: "reclaim_stake",
      args: [id],
      value: 0n,
    });
    await client.waitForTransactionReceipt({
      hash: txHash,
      status: TransactionStatus.FINALIZED,
    });
    return txHash as string;
  } catch (error) {
    throw new Error(normalizeError(error) + methodMismatchHint(error));
  }
}
