"use client";

import React, {
  createContext,
  useContext,
  useEffect,
  useState,
  ReactNode,
} from "react";
import { useWallet, useConnection } from "@solana/wallet-adapter-react";
import { PublicKey } from "@solana/web3.js";
import { useWalletModal } from "@solana/wallet-adapter-react-ui";

interface AuthState {
  isConnected: boolean;
  publicKey: PublicKey | null;
  isAuthenticated: boolean;
  signedMessage: string | null;
  nonce: string | null;
  expiresAt: number | null;
  isConnecting: boolean;
  isSigning: boolean;
  isVerifying: boolean;
  error: string | null;
}

interface StoredAuthData {
  signature: string;
  nonce: string;
  publicKey: string;
  expiresAt: number;
}

interface AuthContextType extends AuthState {
  connectWallet: () => Promise<void>;
  disconnectWallet: () => void;
  signMessage: () => Promise<void>;
  clearError: () => void;
  getTimeUntilExpiration: () => number | null;
  isExpired: () => boolean;
}

const initialState: AuthState = {
  isConnected: false,
  publicKey: null,
  isAuthenticated: false,
  signedMessage: null,
  nonce: null,
  expiresAt: null,
  isConnecting: false,
  isSigning: false,
  isVerifying: false,
  error: null,
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

interface AuthProviderProps {
  children: ReactNode;
}

export function AuthProvider({ children }: AuthProviderProps) {
  const {
    publicKey,
    connected,
    connecting,
    disconnect,
    signMessage: walletSignMessage,
  } = useWallet();
  const { setVisible } = useWalletModal();

  const [state, setState] = useState<AuthState>(initialState);

  const AUTH_STORAGE_KEY = "escrow_auth_data";
  const TWELVE_HOURS = 12 * 60 * 60 * 1000;

  const generateNonce = (): string => {
    return Date.now().toString();
  };

  const createAuthMessage = (nonce: string, publicKey: PublicKey): string => {
    return `Sign this message to authenticate with Escrow Payment\n\nNonce: ${nonce}\nWallet: ${publicKey.toString()}\nTimestamp: ${new Date().toISOString()}`;
  };

  const saveAuthToStorage = (
    signature: string,
    nonce: string,
    publicKey: PublicKey
  ): void => {
    const expiresAt = Date.now() + TWELVE_HOURS;
    const authData: StoredAuthData = {
      signature,
      nonce,
      publicKey: publicKey.toString(),
      expiresAt,
    };
    localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(authData));
  };

  const loadAuthFromStorage = (): StoredAuthData | null => {
    try {
      const stored = localStorage.getItem(AUTH_STORAGE_KEY);
      if (!stored) return null;

      const authData: StoredAuthData = JSON.parse(stored);

      if (Date.now() > authData.expiresAt) {
        localStorage.removeItem(AUTH_STORAGE_KEY);
        return null;
      }

      return authData;
    } catch (error) {
      localStorage.removeItem(AUTH_STORAGE_KEY);
      return null;
    }
  };

  const clearAuthFromStorage = (): void => {
    localStorage.removeItem(AUTH_STORAGE_KEY);
  };

  const verifyStoredAuth = async (
    storedAuth: StoredAuthData,
    currentPublicKey: PublicKey
  ): Promise<boolean> => {
    try {
      if (storedAuth.publicKey !== currentPublicKey.toString()) {
        return false;
      }

      const message = createAuthMessage(storedAuth.nonce, currentPublicKey);
      return storedAuth.signature.length > 0;
    } catch (error) {
      return false;
    }
  };

  useEffect(() => {
    setState((prev) => ({
      ...prev,
      isConnected: connected,
      publicKey: publicKey,
      isConnecting: connecting,
    }));

    if (!connected && state.isConnected) {
      setState((prev) => ({
        ...prev,
        isAuthenticated: false,
        signedMessage: null,
        nonce: null,
        expiresAt: null,
        error: null,
      }));
      clearAuthFromStorage();
    }
  }, [connected, publicKey, connecting, state.isConnected]);

  useEffect(() => {
    if (
      connected &&
      publicKey &&
      !state.isAuthenticated &&
      !state.isVerifying
    ) {
      checkStoredAuth();
    } else if (connected && publicKey && state.isAuthenticated) {
      const storedAuth = loadAuthFromStorage();
      if (storedAuth && storedAuth.publicKey !== publicKey.toString()) {
        clearAuthFromStorage();
        setState((prev) => ({
          ...prev,
          isAuthenticated: false,
          signedMessage: null,
          nonce: null,
          expiresAt: null,
        }));
        if (walletSignMessage) {
          signMessage();
        }
      }
    }
  }, [connected, publicKey, state.isAuthenticated, state.isVerifying]);

  const checkStoredAuth = async (): Promise<void> => {
    if (!publicKey) return;

    setState((prev) => ({ ...prev, isVerifying: true, error: null }));

    try {
      const storedAuth = loadAuthFromStorage();

      if (storedAuth && (await verifyStoredAuth(storedAuth, publicKey))) {
        setState((prev) => ({
          ...prev,
          isAuthenticated: true,
          signedMessage: storedAuth.signature,
          nonce: storedAuth.nonce,
          expiresAt: storedAuth.expiresAt,
          isVerifying: false,
        }));
      } else {
        setState((prev) => ({ ...prev, isVerifying: false }));
        if (walletSignMessage) {
          signMessage();
        }
      }
    } catch (error) {
      setState((prev) => ({
        ...prev,
        error: "Failed to verify stored authentication",
        isVerifying: false,
      }));
    }
  };

  const connectWallet = async (): Promise<void> => {
    try {
      setState((prev) => ({ ...prev, isConnecting: true, error: null }));

      await setVisible(true);
    } catch (error) {
      setState((prev) => ({
        ...prev,
        error:
          error instanceof Error ? error.message : "Failed to connect wallet",
        isConnecting: false,
      }));
    }
  };

  const disconnectWallet = (): void => {
    try {
      disconnect();
      clearAuthFromStorage();
      setState((prev) => ({
        ...prev,
        isAuthenticated: false,
        signedMessage: null,
        nonce: null,
        expiresAt: null,
        error: null,
      }));
    } catch (error) {
      setState((prev) => ({
        ...prev,
        error:
          error instanceof Error
            ? error.message
            : "Failed to disconnect wallet",
      }));
    }
  };

  const signMessage = async (): Promise<void> => {
    if (!publicKey || !walletSignMessage) {
      setState((prev) => ({
        ...prev,
        error: "Wallet not connected or does not support message signing",
      }));
      return;
    }

    try {
      setState((prev) => ({ ...prev, isSigning: true, error: null }));

      const nonce = generateNonce();
      const message = createAuthMessage(nonce, publicKey);

      const encodedMessage = new TextEncoder().encode(message);
      const signature = await walletSignMessage(encodedMessage);

      const signedMessage = Buffer.from(signature).toString("base64");
      const expiresAt = Date.now() + TWELVE_HOURS;

      saveAuthToStorage(signedMessage, nonce, publicKey);

      setState((prev) => ({
        ...prev,
        isAuthenticated: true,
        signedMessage,
        nonce,
        expiresAt,
        isSigning: false,
      }));
    } catch (error) {
      setState((prev) => ({
        ...prev,
        error:
          error instanceof Error
            ? error.message
            : "Failed to sign authentication message",
        isSigning: false,
        isAuthenticated: false,
      }));
    }
  };

  const clearError = (): void => {
    setState((prev) => ({ ...prev, error: null }));
  };

  const getTimeUntilExpiration = (): number | null => {
    if (!state.expiresAt) return null;
    const timeRemaining = state.expiresAt - Date.now();
    return timeRemaining > 0 ? timeRemaining : 0;
  };

  const isExpired = (): boolean => {
    const timeRemaining = getTimeUntilExpiration();
    return timeRemaining !== null && timeRemaining <= 0;
  };

  const contextValue: AuthContextType = {
    ...state,
    connectWallet,
    disconnectWallet,
    signMessage,
    clearError,
    getTimeUntilExpiration,
    isExpired,
  };

  return (
    <AuthContext.Provider value={contextValue}>{children}</AuthContext.Provider>
  );
}

export function useAuth(): AuthContextType {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}

export default AuthContext;
