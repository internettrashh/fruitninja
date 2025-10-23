import React, { createContext, useContext, useEffect, useState } from "react";
import { BrowserProvider, JsonRpcSigner } from "ethers";

type WalletState = {
  address: string | null;
  provider: BrowserProvider | null;
  signer: JsonRpcSigner | null;
  connected: boolean;
  connect: () => Promise<void>;
  disconnect: () => void;
};

const WalletContext = createContext<WalletState | undefined>(undefined);

export const WalletProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [address, setAddress] = useState<string | null>(null);
  const [provider, setProvider] = useState<BrowserProvider | null>(null);
  const [signer, setSigner] = useState<JsonRpcSigner | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const eth = (window as any).ethereum;
    if (!eth) return;

    const handleAccounts = (accounts: string[]) => {
      setAddress(accounts.length ? accounts[0] : null);
    };

    eth.request?.({ method: "eth_accounts" }).then(handleAccounts).catch(() => {});
    eth.on?.("accountsChanged", handleAccounts);

    return () => {
      eth.removeListener?.("accountsChanged", handleAccounts);
    };
  }, []);

  const connect = async () => {
    if (typeof window === "undefined" || !(window as any).ethereum) {
      alert("MetaMask is not installed. Please install it to use this feature.");
      return;
    }
    try {
      await (window as any).ethereum.request({ method: "eth_requestAccounts" });
      const prov = new BrowserProvider((window as any).ethereum);
      const s = await prov.getSigner();
      const addr = await s.getAddress();
      setProvider(prov);
      setSigner(s);
      setAddress(addr);
    } catch (err) {
      console.error("Wallet connect error:", err);
    }
  };

  const disconnect = () => {
    setAddress(null);
    setProvider(null);
    setSigner(null);
  };

  return (
    <WalletContext.Provider
      value={{
        address,
        provider,
        signer,
        connected: !!address,
        connect,
        disconnect,
      }}
    >
      {children}
    </WalletContext.Provider>
  );
};

export function useWallet() {
  const ctx = useContext(WalletContext);
  if (!ctx) throw new Error("useWallet must be used inside WalletProvider");
  return ctx;
}

export function useSigner() {
  const ctx = useContext(WalletContext);
  if (!ctx) throw new Error("useSigner must be used inside WalletProvider");
  return ctx.signer;
}