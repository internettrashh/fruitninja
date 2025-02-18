/// constract is deployed here : xKemU2pWkIh7RVKqPvjqfs71-UNRD4R5jitexQfAYeY
import { message, createDataItemSigner , dryrun} from "@permaweb/aoconnect";

export const submitFruitNinjaScore = async (score: number) => {
  try {
    const result = await message({
      process: "xKemU2pWkIh7RVKqPvjqfs71-UNRD4R5jitexQfAYeY",
      tags: [
        { name: "Action", value: "SubmitScore" },
        { name: "Score", value: score.toString() }
      ],
      signer: createDataItemSigner(window.arweaveWallet),
    });
    
    console.log("Score submitted successfully:", result);
    return result;
  } catch (error) {
    console.error("Error submitting score:", error);
    throw error;
  }
};



export const getFruitNinjaLeaderboard = async () => {
    try {
      const result = await dryrun({
        process: "xKemU2pWkIh7RVKqPvjqfs71-UNRD4R5jitexQfAYeY",
        tags: [
          { name: "Action", value: "GetLeaderboard" }
        ]
      });
  
      // Get the first message from the result
      const leaderboardData = result.Messages[0];
      
      // Parse the JSON data if it exists
      if (leaderboardData?.Data) {
        const leaderboard = JSON.parse(leaderboardData.Data);
        return leaderboard;
      }
  
      console.log("Leaderboard response:", leaderboardData);
      return [];
    } catch (error) {
      console.error("Error fetching leaderboard:", error);
      throw error;
    }
  };
  
  // Optional: Get player's specific score
  export const getPlayerScore = async (walletAddress: string) => {
    try {
      const result = await dryrun({
        process: "xKemU2pWkIh7RVKqPvjqfs71-UNRD4R5jitexQfAYeY",
        tags: [
          { name: "Action", value: "GetPlayerScore" },
          { name: "Wallet", value: walletAddress }
        ]
      });
  
      const scoreData = result.Messages[0];
      if (scoreData?.Data) {
        return JSON.parse(scoreData.Data);
      }
  
      return { score: 0, wallet: walletAddress };
    } catch (error) {
      console.error("Error fetching player score:", error);
      throw error;
    }
  };
