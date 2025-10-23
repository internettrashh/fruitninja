import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App.tsx";
import "./styles/globals.css";
import { WalletProvider } from "./components/walletcontext.tsx";
import process from 'process';
import { Buffer } from 'buffer';

window.process = process;
window.Buffer = Buffer;
window.global = window;




ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
   
      <WalletProvider>
      <App />
    </WalletProvider>
    
  </React.StrictMode>
);