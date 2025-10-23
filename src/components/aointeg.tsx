import { message, dryrun, connect } from "@permaweb/aoconnect";
import { createData, InjectedEthereumSigner } from "@dha-team/arbundles/web";
import { Web3Provider } from "@ethersproject/providers"; // ✅ Browser-safe
import { Signer } from "ethers";

// --- CU configuration ---
const CU_URLS = ["https://cu.ardrive.io", "https://ur-cu.randao.net"];
let currentCuUrlIndex = 0;
const REQUEST_TIMEOUT = 30000;

function getNextCuUrl(): string {
  const url = CU_URLS[currentCuUrlIndex];
  currentCuUrlIndex = (currentCuUrlIndex + 1) % CU_URLS.length;
  return url;
}

function createAoConnection() {
  return connect({
    CU_URL: getNextCuUrl(),
    MODE: "legacy" as const,
  });
}

async function executeWithRetry<T>(
  operation: (ao: any) => Promise<T>,
  maxRetries: number = CU_URLS.length
): Promise<T> {
  let lastError: Error | null = null;

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      const ao = createAoConnection();
      const timeoutPromise = new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error(`Request timeout after ${REQUEST_TIMEOUT}ms`)), REQUEST_TIMEOUT)
      );
      const result = await Promise.race([operation(ao), timeoutPromise]);
      return result;
    } catch (error) {
      lastError = error as Error;
      console.warn(`Attempt ${attempt + 1} failed:`, error);
      if (attempt === maxRetries - 1) break;
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }
  }

  throw new Error(`All attempts failed. Last error: ${lastError?.message}`);
}

// ------------------------------------------------------------
// Browser Ethereum Signer (MetaMask)
export async function createBrowserEthereumDataItemSigner() {
  if (!window.ethereum) throw new Error("MetaMask not found");

  await window.ethereum.request({ method: "eth_requestAccounts" });

  const provider = new Web3Provider(window.ethereum); // ✅ Browser-safe
  const ethSigner: Signer = provider.getSigner();

  const signer = new InjectedEthereumSigner(ethSigner);
  await signer.setPublicKey();

  return async ({ data, tags = [], target = "", anchor = "" }: any) => {
    if (!data) data = "";
    else if (!(data instanceof Uint8Array)) {
      data = new TextEncoder().encode(typeof data === "string" ? data : JSON.stringify(data));
    }

    const dataItem = createData(data, signer, { tags, target, anchor });
    await dataItem.sign(signer);

    return {
      id: dataItem.id,
      raw: await dataItem.getRaw(),
    };
  };
}

// ------------------------------------------------------------
// Submit Score
export const submitFruitNinjaScore = async (score: number) =>
  executeWithRetry(async (ao) => {
    const signer = await createBrowserEthereumDataItemSigner();

    const result = await message({
      process: "xKemU2pWkIh7RVKqPvjqfs71-UNRD4R5jitexQfAYeY",
      tags: [
        { name: "Action", value: "SubmitScore" },
        { name: "Score", value: score.toString() },
      ],
      signer,
    });

    console.log("✅ Score submitted successfully:", result);
    return result;
  });

// ------------------------------------------------------------
// Leaderboard
export const getFruitNinjaLeaderboard = async () =>
  executeWithRetry(async (ao) => {
    const result = await ao.dryrun({
      process: "xKemU2pWkIh7RVKqPvjqfs71-UNRD4R5jitexQfAYeY",
      tags: [{ name: "Action", value: "GetLeaderboard" }],
    });

    const leaderboardData = result.Messages?.[0];
    if (leaderboardData?.Data) return JSON.parse(leaderboardData.Data);
    return [];
  });

// ------------------------------------------------------------
// Player Score
export const getPlayerScore = async (walletAddress: string) =>
  executeWithRetry(async (ao) => {
    const result = await ao.dryrun({
      process: "xKemU2pWkIh7RVKqPvjqfs71-UNRD4R5jitexQfAYeY",
      tags: [
        { name: "Action", value: "GetPlayerScore" },
        { name: "Wallet", value: walletAddress },
      ],
    });

    const scoreData = result.Messages?.[0];
    if (scoreData?.Data) return JSON.parse(scoreData.Data);
    return { score: 0, wallet: walletAddress };
  });
