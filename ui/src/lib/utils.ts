import { PublicKey } from "@solana/web3.js";
import clsx, { ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import nacl from "tweetnacl";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export const verifySignature = async (
  message: string,
  signature: string,
  publicKey: PublicKey
): Promise<boolean> => {
  try {
    const messageBytes = new TextEncoder().encode(message);
    const signatureBytes = Buffer.from(signature, "base64");

    return nacl.sign.detached.verify(
      messageBytes,
      signatureBytes,
      publicKey.toBytes()
    );
  } catch (error) {
    console.error("Failed to verify signature:", error);
    return false;
  }
};

export const truncateAddress = (address: string) => {
  if (!address) return "";
  return `${address.slice(0, 4)}...${address.slice(-4)}`;
};

export const formatTimeRemaining = (timeRemaining: number): string => {
  if (!timeRemaining) return "No expiration";

  const hours = Math.floor(timeRemaining / (1000 * 60 * 60));
  const minutes = Math.floor((timeRemaining % (1000 * 60 * 60)) / (1000 * 60));

  return `${hours}h ${minutes}m`;
};
