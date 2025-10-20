"use client";

import { useState } from "react";
import { Header } from "@/components/Header";
import { AgreementsList } from "@/components/AgreementsList";
import { ThemeToggle } from "@/components/ThemeToggle";

export default function DashboardPage() {
  const [walletConnected, setWalletConnected] = useState(false);
  const [walletAddress, setWalletAddress] = useState("");

  const handleConnectWallet = () => {
    // Simulate wallet connection
    setWalletConnected(true);
    setWalletAddress("7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU");
  };

  const handleDisconnectWallet = () => {
    setWalletConnected(false);
    setWalletAddress("");
  };

  return (
    <div className="min-h-screen bg-background">
      <Header
        walletConnected={walletConnected}
        walletAddress={walletAddress}
        onConnect={handleConnectWallet}
        onDisconnect={handleDisconnectWallet}
      />

      <main className="container mx-auto px-4 py-8">
        {!walletConnected ? (
          <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
            <div className="text-center space-y-2">
              <h2 className="text-2xl font-semibold text-foreground">
                {"Connect Your Wallet"}
              </h2>
              <p className="text-muted-foreground">
                {
                  "Connect your Solana wallet to view and manage payment agreements"
                }
              </p>
            </div>
          </div>
        ) : (
          <AgreementsList walletAddress={walletAddress} />
        )}
      </main>

      <ThemeToggle />
    </div>
  );
}
