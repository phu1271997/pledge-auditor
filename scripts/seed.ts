// scripts/seed.ts
// Seed a freshly deployed contract with a few sample pledges so the dApp
// isn't empty during a demo. Reads VITE_CONTRACT_ADDRESS from the env.
//
// Usage:
//   DEPLOYER_PRIVATE_KEY=0x... VITE_CONTRACT_ADDRESS=0x... npx tsx scripts/seed.ts

import { createClient, createAccount } from "genlayer-js";
import { simulator } from "genlayer-js/chains";
import { type Address, TransactionStatus } from "genlayer-js/types";

const SAMPLES = [
  {
    id: "acme-refund-30d",
    orgName: "Acme Store",
    description: "We refund any return within 30 days, no questions asked.",
    evidenceUrl: "https://example.org/acme/refund-policy",
    stake: 2000n,
  },
  {
    id: "globex-carbon-2030",
    orgName: "Globex Industries",
    description: "We will be carbon neutral across all operations by 2030.",
    evidenceUrl: "https://example.org/globex/sustainability-report",
    stake: 5000n,
  },
  {
    id: "initech-uptime",
    orgName: "Initech Cloud",
    description: "Our API maintains 99.9% monthly uptime for all paid tiers.",
    evidenceUrl: "https://example.org/initech/status",
    stake: 3000n,
  },
];

async function main() {
  const pk = process.env.DEPLOYER_PRIVATE_KEY as `0x${string}`;
  const address = process.env.VITE_CONTRACT_ADDRESS as Address;
  if (!pk || !address) {
    throw new Error("Set DEPLOYER_PRIVATE_KEY and VITE_CONTRACT_ADDRESS");
  }

  const client = createClient({
    chain: simulator,
    endpoint: "https://studio.genlayer.com/api",
    account: createAccount(pk),
  });

  for (const s of SAMPLES) {
    console.log("Seeding", s.id, "…");
    const tx = await client.writeContract({
      address,
      functionName: "register_pledge",
      args: [s.id, s.orgName, s.description, s.evidenceUrl],
      value: s.stake,
    });
    await client.waitForTransactionReceipt({ hash: tx, status: TransactionStatus.FINALIZED });
  }
  console.log("✅ Seeded", SAMPLES.length, "pledges");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
