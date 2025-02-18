import { useEffect, useState } from 'react'
import { useConnection } from '@arweave-wallet-kit/react'
import { getFruitNinjaLeaderboard, submitFruitNinjaScore } from './aointeg'
import { useActiveAddress } from '@arweave-wallet-kit/react'

// Update the type to match your actual data structure
type LeaderboardEntry = {
  wallet: string      // Changed from address to wallet
  score: number
  lastUpdated: string // Changed from timestamp to lastUpdated
}

export default function Leaderboard({ currentScore }: { currentScore: number }) {
  const [scores, setScores] = useState<LeaderboardEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const { connected } = useConnection()
  const activeAddress = useActiveAddress()

  useEffect(() => {
    fetchLeaderboard()
  }, [])

  // Submit score when game ends
  useEffect(() => {
    const submitScore = async () => {
      if (currentScore > 0 && connected) {
        try {
          await submitFruitNinjaScore(currentScore)
          // Refresh leaderboard after submitting
          await fetchLeaderboard()
        } catch (err) {
          console.error('Error submitting score:', err)
          setError('Failed to submit score')
        }
      }
    }

    submitScore()
  }, [currentScore, connected])

  const fetchLeaderboard = async () => {
    try {
      setLoading(true)
      const leaderboardData = await getFruitNinjaLeaderboard()
      console.log('Leaderboard data:', leaderboardData)
      
      // Transform the data to ensure it's valid
      const validScores = Array.isArray(leaderboardData) 
        ? leaderboardData.filter(score => 
            score && 
            typeof score.wallet === 'string' && 
            typeof score.score === 'number'
          )
        : [];
      
      // Sort scores by highest first
      validScores.sort((a, b) => b.score - a.score);
      
      setScores(validScores)
      setError(null)
    } catch (err) {
      setError('Failed to load leaderboard')
      console.error('Leaderboard fetch error:', err)
    } finally {
      setLoading(false)
    }
  }

  const formatAddress = (address: string | null | undefined) => {
    if (!address) return 'Unknown'
    if (address.length < 8) return address
    return `${address.slice(0, 4)}...${address.slice(-4)}`
  }

  const formatDate = (dateStr: string) => {
    try {
      return new Date(dateStr).toLocaleDateString()
    } catch (err) {
      return dateStr || 'Invalid Date'
    }
  }

  const isNewHighScore = () => {
    if (!scores.length) return currentScore > 0
    return currentScore > Math.min(...scores.map(s => s.score))
  }

  return (
    <div className="w-full max-w-md mx-auto bg-gray-800/90 rounded-xl shadow-xl p-6">
      <h3 className="text-2xl font-bold text-white mb-4 text-center">
        Leaderboard
      </h3>

      {loading ? (
        <div className="flex justify-center items-center py-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-white"></div>
        </div>
      ) : error ? (
        <div className="text-red-400 text-center py-4">{error}</div>
      ) : (
        <>
          {isNewHighScore() && (
            <div className="text-yellow-400 text-center mb-4 animate-pulse">
              🎉 New High Score! 🎉
            </div>
          )}

          <div className="space-y-2 max-h-[300px] overflow-y-auto scrollbar-thin scrollbar-thumb-purple-500 scrollbar-track-gray-700">
            {scores.slice(0, 10).map((entry, index) => (
              <div
                key={`${entry.wallet}-${entry.lastUpdated || index}`}
                className={`flex items-center justify-between p-2 rounded-lg ${
                  connected && activeAddress && entry.wallet === activeAddress
                    ? 'bg-purple-700/50'
                    : 'bg-gray-700/30'
                }`}
              >
                <div className="flex items-center gap-3">
                  <span className="text-gray-400 w-6">#{index + 1}</span>
                  <div className="flex flex-col">
                    <span className="text-white font-medium">
                      {formatAddress(entry.wallet)}
                    </span>
                    <span className="text-xs text-gray-400">
                      {formatDate(entry.lastUpdated)}
                    </span>
                  </div>
                </div>
                <span className="text-xl font-bold text-purple-400">
                  {entry.score.toLocaleString()}
                </span>
              </div>
            ))}
          </div>

          {scores.length === 0 && (
            <div className="text-gray-400 text-center py-4">
              No scores yet. Be the first!
            </div>
          )}
        </>
      )}
    </div>
  )
}
