import React from "react";
import { useWallet } from "./walletcontext";

export default function ConnectButton() {
  const { address, connected, connect, disconnect } = useWallet();

  const shortAccount = (addr: string | null) => (addr ? `${addr.slice(0, 6)}...${addr.slice(-4)}` : "");

  return (
    <div>
      {connected ? (
        <button onClick={disconnect} aria-label="Disconnect wallet" className="px-3 py-1 rounded bg-gray-800 text-white">
          Connected: {shortAccount(address)}
        </button>
      ) : (
        <button onClick={connect} aria-label="Connect wallet" className="px-3 py-1 rounded bg-purple-600 text-white">
          Connect Wallet
        </button>
      )}
    </div>
  );
}