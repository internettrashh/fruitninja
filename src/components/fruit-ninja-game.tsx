import type React from "react"
import { useState, useRef, useEffect } from "react"
import { ConnectButton, useConnection } from "@arweave-wallet-kit/react";
import Leaderboard from './leaderboard'

const GAME_CONFIG = {
  FRUIT_SIZE: 40,
  FRUIT_SPAWN_CHANCE: 0.03,
  MIN_SLASH_VELOCITY: 1.5,
  MAX_SLASH_LENGTH: 150,
  GRAVITY: 0.5,
  ASPECT_RATIO: 9 / 16, // Inverted for vertical-first design
};

const fruitTypes = [
  { emoji: "🍎", points: 1 },
  { emoji: "🍌", points: 2 },
  { emoji: "🍊", points: 3 },
  { emoji: "🍉", points: 5 },
]

export default function FruitNinjaGame() {
  const [gameState, setGameState] = useState("start")
  const [score, setScore] = useState(0)
  const [timeLeft, setTimeLeft] = useState(60)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [fruits, setFruits] = useState<Fruit[]>([])
  const [slashHistory, setSlashHistory] = useState<Point[]>([])
  const [lastSlashTime, setLastSlashTime] = useState(0)
  const [difficulty, setDifficulty] = useState(1)
  const [lastFrameTime, setLastFrameTime] = useState(0)
  const [mouseVelocity, setMouseVelocity] = useState<number>(0);
  const [lastMousePosition, setLastMousePosition] = useState<Point | null>(null);
  const [lastMouseTime, setLastMouseTime] = useState<number>(0);
  const { connected, connect } = useConnection()

  type Point = { x: number; y: number }
  type Fruit = {
    id: number
    x: number
    y: number
    type: (typeof fruitTypes)[number]
    velocityX: number
    velocityY: number
  }

  useEffect(() => {
    if (gameState === "playing") {
      const timer = setInterval(() => {
        setTimeLeft((prevTime) => {
          if (prevTime <= 1) {
            clearInterval(timer)
            setGameState("gameover")
            return 0
          }
          return prevTime - 1
        })
      }, 1000)
      return () => clearInterval(timer)
    }
  }, [gameState])

  useEffect(() => {
    if (gameState === "playing") {
      let animationFrameId: number;
      
      const gameLoop = (timestamp: number) => {
        if (!lastFrameTime) {
          setLastFrameTime(timestamp);
        }
        
        updateGame(timestamp);
        animationFrameId = requestAnimationFrame(gameLoop);
      };

      animationFrameId = requestAnimationFrame(gameLoop);
      
      return () => {
        cancelAnimationFrame(animationFrameId);
      };
    }
  }, [gameState, fruits, slashHistory, difficulty]);

  useEffect(() => {
    const handleResize = () => {
      const canvas = canvasRef.current;
      if (!canvas) return;

      const container = canvas.parentElement;
      if (!container) return;

      const containerWidth = container.clientWidth;
      const containerHeight = container.clientHeight;
      let width, height;

      // Check if we're on mobile (or in portrait orientation)
      if (window.innerWidth <= 768 || window.innerHeight > window.innerWidth) {
        // On mobile, use most of the screen height
        height = containerHeight * 0.95;
        width = height * (3/4); // Use 3:4 aspect ratio on mobile

        // Make sure width doesn't exceed screen width
        if (width > containerWidth * 0.95) {
          width = containerWidth * 0.95;
          height = width * (4/3);
        }
      } else {
        // On desktop, use landscape orientation
        width = containerWidth * 0.8;
        height = width * (9/16);

        // Make sure height doesn't exceed container
        if (height > containerHeight * 0.9) {
          height = containerHeight * 0.9;
          width = height * (16/9);
        }
      }

      // Update canvas size
      canvas.width = width;
      canvas.height = height;

      // Adjust fruit size based on canvas dimensions
      const scaleFactor = Math.min(width, height) / 800;
      GAME_CONFIG.FRUIT_SIZE = Math.max(30, Math.floor(40 * scaleFactor));
    };

    window.addEventListener('resize', handleResize);
    handleResize();

    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const updateGame = (timestamp: number) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const deltaTime = timestamp - lastFrameTime;
    const timeScale = deltaTime / (1000 / 60); // Normalize to 60fps

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Update difficulty based on score
    const newDifficulty = Math.floor(score / 100) + 1;
    if (newDifficulty !== difficulty) {
      setDifficulty(newDifficulty);
    }

    // Adjust fruit spawning physics for more realistic motion
    const spawnChance = GAME_CONFIG.FRUIT_SPAWN_CHANCE + (difficulty * 0.01);
    if (Math.random() < spawnChance) {
      const newFruit: Fruit = {
        id: Date.now(),
        x: Math.random() * canvas.width,
        y: canvas.height + GAME_CONFIG.FRUIT_SIZE, // Start below screen
        type: fruitTypes[Math.floor(Math.random() * fruitTypes.length)],
        velocityX: (Math.random() * 6 - 3) * (1 + difficulty * 0.1), // Increased horizontal velocity range
        velocityY: (-Math.random() * 15 - 10) * (1 + difficulty * 0.1), // Increased upward velocity
      };
      setFruits(prevFruits => [...prevFruits, newFruit]);
    }

    // Update and draw fruits with time scaling
    setFruits(prevFruits =>
      prevFruits
        .map(fruit => ({
          ...fruit,
          x: fruit.x + fruit.velocityX * timeScale,
          y: fruit.y + fruit.velocityY * timeScale,
          velocityY: fruit.velocityY + GAME_CONFIG.GRAVITY * timeScale,
        }))
        .filter(fruit => fruit.y < canvas.height + GAME_CONFIG.FRUIT_SIZE) // Keep fruits slightly below screen
    );

    // Draw fruits
    fruits.forEach((fruit) => {
      ctx.font = `${GAME_CONFIG.FRUIT_SIZE}px Arial`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(fruit.type.emoji, fruit.x, fruit.y);
    });

    // Draw slash trail with gradient and fade effect
    if (slashHistory.length > 1) {
      ctx.beginPath();
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';

      // Create gradient for the slash
      const gradient = ctx.createLinearGradient(
        slashHistory[0].x,
        slashHistory[0].y,
        slashHistory[slashHistory.length - 1].x,
        slashHistory[slashHistory.length - 1].y
      );
      gradient.addColorStop(0, 'rgba(255, 255, 255, 0)');
      gradient.addColorStop(0.5, 'rgba(255, 255, 255, 0.8)');
      gradient.addColorStop(1, 'rgba(255, 255, 255, 0.4)');

      ctx.strokeStyle = gradient;
      ctx.lineWidth = 12; // Outer glow
      ctx.beginPath();
      ctx.moveTo(slashHistory[0].x, slashHistory[0].y);
      
      // Create smooth curve through points
      for (let i = 1; i < slashHistory.length - 2; i++) {
        const xc = (slashHistory[i].x + slashHistory[i + 1].x) / 2;
        const yc = (slashHistory[i].y + slashHistory[i + 1].y) / 2;
        ctx.quadraticCurveTo(slashHistory[i].x, slashHistory[i].y, xc, yc);
      }
      
      if (slashHistory.length > 2) {
        ctx.quadraticCurveTo(
          slashHistory[slashHistory.length - 2].x,
          slashHistory[slashHistory.length - 2].y,
          slashHistory[slashHistory.length - 1].x,
          slashHistory[slashHistory.length - 1].y
        );
      }
      
      ctx.stroke();

      // Inner bright line
      ctx.lineWidth = 4;
      ctx.strokeStyle = 'rgba(255, 255, 255, 1)';
      ctx.stroke();

      // Remove old points if not actively slashing
      if (timestamp - lastSlashTime > 32) { // Faster fade-out
        setSlashHistory(prev => prev.slice(1));
      }
    }

    setLastFrameTime(timestamp);
  };

  const startGame = async () => {
    if (!connected) {
      try {
        await connect()
        return // Don't start game immediately after connection
      } catch (error) {
        console.error("Failed to connect wallet:", error)
        return
      }
    }
    setGameState("playing")
    setScore(0)
    setTimeLeft(60)
    setFruits([])
  }

  const handlePointerDown = (event: React.PointerEvent<HTMLCanvasElement>) => {
    if (!connected) {
      return; // Prevent gameplay if wallet not connected
    }
    
    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;
    
    setSlashHistory([{ x, y }]);
    setLastMousePosition({ x, y });
    setLastMouseTime(Date.now());
    setLastSlashTime(Date.now());
  };

  const handlePointerMove = (event: React.PointerEvent<HTMLCanvasElement>) => {
    if (!connected) {
      return; // Prevent gameplay if wallet not connected
    }
    if (slashHistory.length === 0 || !connected || gameState !== "playing") return;

    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;
    const currentTime = Date.now();

    // Calculate mouse velocity with improved precision
    if (lastMousePosition) {
      const timeDelta = Math.max(1, currentTime - lastMouseTime); // Prevent division by zero
      const distance = Math.sqrt(
        Math.pow(x - lastMousePosition.x, 2) + 
        Math.pow(y - lastMousePosition.y, 2)
      );
      const velocity = distance / timeDelta * 10; // Scale up for better detection
      setMouseVelocity(velocity);
    }

    // Only add points if moving fast enough and game is active
    if (mouseVelocity > GAME_CONFIG.MIN_SLASH_VELOCITY && gameState === "playing") {
      setSlashHistory(prev => {
        if (prev.length === 0) return [{ x, y }];

        const lastPoint = prev[prev.length - 1];
        const distance = Math.sqrt(
          Math.pow(x - lastPoint.x, 2) + Math.pow(y - lastPoint.y, 2)
        );

        // Don't add points too close together
        if (distance < 5) return prev; // Reduced minimum distance

        // Limit slash length
        const newHistory = [...prev, { x, y }];
        return newHistory.slice(-12); // Increased trail length
      });

      setLastSlashTime(currentTime);

      // Check for sliced fruits with improved hit detection
      if (slashHistory.length >= 2) {
        const lastPoint = slashHistory[slashHistory.length - 1];
        setFruits(prevFruits => {
          const slicedFruits = prevFruits.filter(fruit => {
            const distanceToSlash = pointToLineDistance(
              fruit.x,
              fruit.y,
              x,
              y,
              lastPoint.x,
              lastPoint.y
            );
            return distanceToSlash < GAME_CONFIG.FRUIT_SIZE * 0.75; // Increased hit area
          });

          if (slicedFruits.length > 0) {
            setScore(prevScore => 
              prevScore + slicedFruits.reduce((sum, fruit) => sum + fruit.type.points, 0)
            );
          }

          return prevFruits.filter(fruit => !slicedFruits.includes(fruit));
        });
      }
    }

    setLastMousePosition({ x, y });
    setLastMouseTime(currentTime);
  };

  const handlePointerUp = () => {
    setSlashHistory([]);
    setLastMousePosition(null);
    setMouseVelocity(0);
  };

  // Also handle pointer leave to clean up slash
  const handlePointerLeave = () => {
    setSlashHistory([]);
    setLastMousePosition(null);
    setMouseVelocity(0);
  };

  // Helper function to calculate point-to-line distance
  const pointToLineDistance = (
    px: number,
    py: number,
    x1: number,
    y1: number,
    x2: number,
    y2: number
  ) => {
    const A = px - x1;
    const B = py - y1;
    const C = x2 - x1;
    const D = y2 - y1;

    const dot = A * C + B * D;
    const lenSq = C * C + D * D;
    let param = -1;

    if (lenSq !== 0) {
      param = dot / lenSq;
    }

    let xx, yy;

    if (param < 0) {
      xx = x1;
      yy = y1;
    } else if (param > 1) {
      xx = x2;
      yy = y2;
    } else {
      xx = x1 + param * C;
      yy = y1 + param * D;
    }

    const dx = px - xx;
    const dy = py - yy;

    return Math.sqrt(dx * dx + dy * dy);
  };

  return (
    <div className="w-full h-screen flex flex-col items-center justify-center bg-gradient-to-b from-purple-900 to-gray-900 overflow-hidden">
      {/* Move ConnectButton to top-left and adjust spacing */}
      <div className="absolute top-4 left-4 z-50">
        <ConnectButton />
      </div>

      {/* Game container */}
      <div className="relative w-full h-full flex items-center justify-center">
        <canvas
          ref={canvasRef}
          className="rounded-lg shadow-2xl border-2 border-purple-500/30 touch-none"
          style={{ touchAction: 'none' }}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerLeave={handlePointerLeave}
        />

        {/* Adjusted HUD Overlay - moved timer to bottom */}
        <div className="absolute inset-0 pointer-events-none">
          {/* Score at top-right */}
          <div className="absolute top-4 right-4">
            <div className="bg-black/50 backdrop-blur-sm rounded-lg p-2 sm:p-3">
              <div className="text-white text-lg sm:text-2xl font-bold">
                Score: {score}
              </div>
            </div>
          </div>
          
          {/* Timer at bottom-center */}
          <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2">
            <div className="bg-black/50 backdrop-blur-sm rounded-lg p-2 sm:p-3">
              <div className="text-white text-lg sm:text-2xl font-bold">
                Time: {timeLeft}s
              </div>
            </div>
          </div>
        </div>

        {/* Game state overlays */}
        {gameState !== "playing" && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/70 backdrop-blur-sm">
            {gameState === "start" ? (
              <div className="text-center p-4">
                <h1 className="text-3xl sm:text-5xl font-bold text-white mb-4 sm:mb-8 animate-pulse">
                  🍉 Fruit Ninja 🗡️
                </h1>
                {!connected ? (
                  <div className="flex flex-col items-center gap-4">
                    <p className="text-white text-lg mb-4">
                      Please connect your wallet to play
                    </p>
                    <ConnectButton />
                  </div>
                ) : (
                  <div className="flex flex-col items-center gap-4">
                    <button
                      className="px-6 py-3 sm:px-8 sm:py-4 bg-gradient-to-r from-purple-600 to-pink-600 
                               text-white text-lg sm:text-xl font-bold rounded-lg shadow-lg 
                               hover:from-purple-700 hover:to-pink-700 transform hover:scale-105 
                               transition-all active:scale-95"
                      onClick={startGame}
                    >
                      Start Game
                    </button>
                    <button
                      className="px-6 py-2 sm:px-8 sm:py-3 bg-gradient-to-r from-gray-600 to-gray-700 
                               text-white text-base sm:text-lg font-semibold rounded-lg shadow-lg 
                               hover:from-gray-700 hover:to-gray-800 transform hover:scale-105 
                               transition-all active:scale-95"
                      onClick={() => setGameState("leaderboard")}
                    >
                      View Leaderboard
                    </button>
                  </div>
                )}
              </div>
            ) : gameState === "leaderboard" ? (
              <div className="text-center bg-gray-900/90 p-6 sm:p-8 rounded-xl shadow-2xl border border-purple-500/30">
                <h2 className="text-2xl sm:text-4xl font-bold text-white mb-3 sm:mb-4">
                  Leaderboard
                </h2>
                <div className="mb-6">
                  <Leaderboard currentScore={0} />
                </div>
                <button
                  className="px-6 py-3 sm:px-8 sm:py-4 bg-gradient-to-r from-purple-600 to-pink-600 
                           text-white text-lg sm:text-xl font-bold rounded-lg shadow-lg 
                           hover:from-purple-700 hover:to-pink-700 transform hover:scale-105 
                           transition-all active:scale-95"
                  onClick={() => setGameState("start")}
                >
                  Back to Menu
                </button>
              </div>
            ) : (
              <div className="text-center bg-gray-900/90 p-6 sm:p-8 rounded-xl shadow-2xl border border-purple-500/30">
                <h2 className="text-2xl sm:text-4xl font-bold text-white mb-3 sm:mb-4">
                  Game Over!
                </h2>
                <div className="text-xl sm:text-3xl text-purple-400 mb-4 sm:mb-6">
                  Final Score: {score}
                </div>
                
                {/* Add Leaderboard */}
                <div className="mb-6">
                  <Leaderboard currentScore={score} />
                </div>

                {!connected ? (
                  <div className="flex flex-col items-center gap-4">
                    <p className="text-white text-lg mb-4">
                      Please connect your wallet to play again
                    </p>
                    <ConnectButton />
                  </div>
                ) : (
                  <button
                    className="px-6 py-3 sm:px-8 sm:py-4 bg-gradient-to-r from-purple-600 to-pink-600 
                             text-white text-lg sm:text-xl font-bold rounded-lg shadow-lg 
                             hover:from-purple-700 hover:to-pink-700 transform hover:scale-105 
                             transition-all active:scale-95"
                    onClick={startGame}
                  >
                    Play Again
                  </button>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

