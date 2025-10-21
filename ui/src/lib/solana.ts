import { EscrowPaymentSDK } from "../../../sdk/sdk";

const RPC_URL =
  process.env.NEXT_PUBLIC_SOLANA_RPC_URL || "https://api.devnet.solana.com";

if (!process.env.NEXT_PUBLIC_SOLANA_RPC_URL) {
  console.warn("NEXT_PUBLIC_SOLANA_RPC_URL not set, using default devnet RPC");
}

export const SDK = new EscrowPaymentSDK(RPC_URL);