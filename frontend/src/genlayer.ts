// src/genlayer.ts
// Thin wrapper around genlayer-js for the Pledge Auditor dApp.
// All reads/writes go to the REAL deployed Intelligent Contract.

import {
  createClient,
  createAccount,
  generatePrivateKey,
} from "genlayer-js";
import { simulator } from "genlayer-js/chains";
import { type Address, TransactionStatus } from "genlayer-js/types";

// Replace with your deployed contract address (see scripts/deploy.ts output).
export const CONTRACT_ADDRESS = ((import.meta as any).env
  .VITE_CONTRACT_ADDRESS || "0x0000000000000000000000000000000000000000") as Address;

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

function getAccount() {
  // In production, integrate a wallet. For demo/testnet we derive a local key
  // (persisted in localStorage) so users can transact frictionlessly.
  let pk = localStorage.getItem("pa_pk");
  if (!pk) {
    pk = generatePrivateKey();
    localStorage.setItem("pa_pk", pk);
  }
  return createAccount(pk as `0x${string}`);
}

export function getClient() {
  return createClient({
    chain: simulator,
    endpoint: "https://studio.genlayer.com/api",
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

export async function listPledges(): Promise<PledgeSummary[]> {
  const client = getClient();
  const raw = await client.readContract({
    address: CONTRACT_ADDRESS,
    functionName: "list_pledges",
    args: [],
  });
  return JSON.parse(raw as string);
}

export async function getPledge(id: string): Promise<PledgeDetail> {
  const client = getClient();
  const raw = await client.readContract({
    address: CONTRACT_ADDRESS,
    functionName: "get_pledge",
    args: [id],
  });
  return JSON.parse(raw as string);
}

export async function registerPledge(params: {
  id: string;
  orgName: string;
  description: string;
  evidenceUrl: string;
  stake: bigint;
}): Promise<string> {
  const client = getClient();
  const txHash = await client.writeContract({
    address: CONTRACT_ADDRESS,
    functionName: "register_pledge",
    args: [params.id, params.orgName, params.description, params.evidenceUrl],
    value: params.stake,
  });
  await client.waitForTransactionReceipt({ hash: txHash, status: TransactionStatus.FINALIZED });
  return txHash;
}

// Trigger an on-chain audit. This is the call that fires the AI jury:
// the contract reads the evidence URL and the validators reach consensus on
// the verdict. Expect this to take longer than a normal tx (consensus + LLM).
export async function auditPledge(id: string): Promise<string> {
  const client = getClient();
  const txHash = await client.writeContract({
    address: CONTRACT_ADDRESS,
    functionName: "audit_pledge",
    args: [id],
    value: 0n,
  });
  await client.waitForTransactionReceipt({ hash: txHash, status: TransactionStatus.FINALIZED });
  return txHash;
}

export async function reclaimStake(id: string): Promise<string> {
  const client = getClient();
  const txHash = await client.writeContract({
    address: CONTRACT_ADDRESS,
    functionName: "reclaim_stake",
    args: [id],
    value: 0n,
  });
  await client.waitForTransactionReceipt({ hash: txHash, status: TransactionStatus.FINALIZED });
  return txHash;
}
