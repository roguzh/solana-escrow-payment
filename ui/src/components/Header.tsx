"use client";

import { Button } from "@/components/ui/button";
import { CreateAgreementDialog } from "@/components/CreateAgreementDialog";
import { useAuth } from "@/contexts/AuthContext";
import { Badge } from "@/components/ui/badge";
import { truncateAddress } from "@/lib/utils";

export function Header() {
  const {
    isConnected,
    isAuthenticated,
    publicKey,
    isConnecting,
    isSigning,
    isVerifying,
    error,
    connectWallet,
    disconnectWallet,
    signMessage,
    clearError,
    getTimeUntilExpiration,
    isExpired,
  } = useAuth();

  return (
    <header className="border-b border-border bg-card">
      <div className="container mx-auto px-4 py-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="text-2xl font-bold text-foreground font-mono">
            {"SolPay"}
          </div>
        </div>

        <div className="flex items-center gap-3">
          {/* Error Display */}
          {error && (
            <div className="flex items-center bg-destructive/10 border border-destructive/20 rounded-md px-3 py-1">
              <span className="text-destructive text-sm">{error}</span>
              <Button
                variant="ghost"
                size="sm"
                onClick={clearError}
                className="ml-2 h-auto p-0 text-destructive hover:text-destructive"
              >
                ×
              </Button>
            </div>
          )}

          {/* Show create agreement dialog only if authenticated */}
          {isConnected && isAuthenticated && !isExpired() && (
            <CreateAgreementDialog />
          )}

          {/* Wallet Connection Status */}
          {isConnected && publicKey ? (
            <div className="flex items-center gap-2">
              {/* Re-sign button if needed */}
              {(!isAuthenticated || isExpired()) && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={signMessage}
                  disabled={isSigning || isVerifying}
                  className="text-xs"
                >
                  {isSigning ? "Signing..." : "Sign Message"}
                </Button>
              )}

              {/* Wallet Address */}
              <Button
                variant="outline"
                onClick={disconnectWallet}
                className="font-mono bg-transparent"
              >
                {truncateAddress(publicKey.toBase58())}
              </Button>
            </div>
          ) : (
            <Button
              onClick={connectWallet}
              disabled={isConnecting}
              className="font-semibold"
            >
              {isConnecting ? "Connecting..." : "Connect Wallet"}
            </Button>
          )}
        </div>
      </div>
    </header>
  );
}
