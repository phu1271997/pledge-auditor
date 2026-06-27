// scripts/deploy.ts
// Deploy the Pledge Auditor Intelligent Contract and print the address.
//
// Usage:
//   1. Set DEPLOYER_PRIVATE_KEY (a funded testnet key) in your env.
//   2. npx tsx scripts/deploy.ts
//   3. Copy the printed address into frontend/.env (VITE_CONTRACT_ADDRESS).
//
// For Studio: you can also just paste contracts/pledge_auditor.py into the
// Run & Debug panel and deploy from the browser. This script is for CLI / CI.

import { readFileSync } from "node:fs";
import { createClient, createAccount } from "genlayer-js";
import { studionet } from "genlayer-js/chains";
import { TransactionStatus } from "genlayer-js/types";

const CONTRACT_PATH = new URL(
  "../contracts/pledge_auditor.py",
  import.meta.url
);

async function main() {
  const pk = process.env.DEPLOYER_PRIVATE_KEY as `0x${string}`;
  if (!pk) throw new Error("Set DEPLOYER_PRIVATE_KEY in your environment");

  const account = createAccount(pk);
  const client = createClient({
    chain: studionet,
    account,
  });

  const code = readFileSync(CONTRACT_PATH, "utf-8");

  console.log("Deploying Pledge Auditor…");
  const txHash = await client.deployContract({
    code,
    args: [],
  });
  console.log("Deploy tx:", txHash);

  const receipt = await client.waitForTransactionReceipt({
    hash: txHash,
    status: TransactionStatus.FINALIZED,
  });

  // genlayer-js exposes the new contract address on the receipt.
  const address =
    (receipt as any).contractAddress ?? (receipt as any).data?.contract_address;
  console.log("✅ Deployed at:", address);
  console.log("Put this in frontend/.env:");
  console.log(`VITE_CONTRACT_ADDRESS=${address}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
