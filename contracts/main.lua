-- Initialize SQLite database
json = require("json")
if not db then
  db = require("lsqlite3").open_memory()
  
  -- Create high scores table
  db:exec[[
    CREATE TABLE IF NOT EXISTS high_scores (
      wallet_address TEXT PRIMARY KEY,
      score INTEGER NOT NULL,
      last_updated DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  ]]
end

-- Handler to submit new score
Handlers.add(
  "submit-score",
  Handlers.utils.hasMatchingTag("Action", "SubmitScore"),
  function(msg)
    -- Validate input
    assert(type(msg.Tags.Score) == 'string', 'Score is required!')
    assert(type(msg.From) == 'string', 'Wallet address is required!')
    
    local score = tonumber(msg.Tags.Score)
    assert(score and score > 0, 'Score must be a positive number!')
    
    -- Check existing score
    local stmt = db:prepare[[
      SELECT score FROM high_scores 
      WHERE wallet_address = ?
    ]]
    stmt:bind(1, msg.From)
    
    local currentScore = 0
    for row in stmt:nrows() do
      currentScore = row.score
    end
    stmt:finalize()
    
    -- Update score if it's higher
    if score > currentScore then
      local updateStmt = db:prepare[[
        INSERT OR REPLACE INTO high_scores (wallet_address, score, last_updated)
        VALUES (?, ?, CURRENT_TIMESTAMP)
      ]]
      
      updateStmt:bind(1, msg.From)
      updateStmt:bind(2, score)
      local success = updateStmt:step()
      updateStmt:finalize()
      
      if success then
        ao.send({
          Target = msg.From,
          Action = "ScoreUpdated",
          Tags = {
            Status = "Success",
            ["Previous-Score"] = tostring(currentScore),
            ["New-Score"] = tostring(score)
          },
          Data = "High score updated successfully!"
        })
      else
        ao.send({
          Target = msg.From,
          Action = "Error",
          Tags = { Status = "Failed" },
          Data = "Failed to update score in database"
        })
      end
    else
      ao.send({
        Target = msg.From,
        Action = "ScoreUnchanged",
        Tags = {
          Status = "Unchanged",
          ["Current-High-Score"] = tostring(currentScore)
        },
        Data = "Submitted score is not higher than existing high score"
      })
    end
  end
)

-- Handler to get leaderboard
Handlers.add(
  "get-leaderboard",
  Handlers.utils.hasMatchingTag("Action", "GetLeaderboard"),
  function(msg)
    local leaderboard = {}
    
    -- Query top 10 scores
    for row in db:nrows([[
      SELECT wallet_address, score, last_updated
      FROM high_scores
      ORDER BY score DESC
      LIMIT 10
    ]]) do
      table.insert(leaderboard, {
        wallet = row.wallet_address,
        score = row.score,
        lastUpdated = row.last_updated
      })
    end
    
    -- Send response
    ao.send({
      Target = msg.From,
      Action = "LeaderboardData",
      Tags = {
        Status = "Success",
        ["Total-Players"] = tostring(#leaderboard)
      },
      Data = json.encode(leaderboard)
    })
  end
)

-- Handler to get player score
Handlers.add(
  "get-player-score",
  Handlers.utils.hasMatchingTag("Action", "GetPlayerScore"),
  function(msg)
    local wallet = msg.Tags.Wallet or msg.From
    
    local stmt = db:prepare[[
      SELECT score, last_updated 
      FROM high_scores 
      WHERE wallet_address = ?
    ]]
    stmt:bind(1, wallet)
    
    local playerData = {
      wallet = wallet,
      score = 0,
      lastUpdated = nil
    }
    
    for row in stmt:nrows() do
      playerData.score = row.score
      playerData.lastUpdated = row.last_updated
    end
    stmt:finalize()
    
    ao.send({
      Target = msg.From,
      Action = "PlayerScore",
      Tags = {
        Status = "Success",
        Wallet = wallet,
        Score = tostring(playerData.score)
      },
      Data = json.encode(playerData)
    })
  end
)

-- Handler to get statistics
Handlers.add(
  "get-stats",
  Handlers.utils.hasMatchingTag("Action", "GetStats"),
  function(msg)
    local stats = {}
    
    -- Get total players
    for row in db:nrows("SELECT COUNT(*) as count FROM high_scores") do
      stats.totalPlayers = row.count
    end
    
    -- Get highest score
    for row in db:nrows("SELECT MAX(score) as max_score FROM high_scores") do
      stats.highestScore = row.max_score or 0
    end
    
    -- Get average score
    for row in db:nrows("SELECT AVG(score) as avg_score FROM high_scores") do
      stats.averageScore = math.floor(row.avg_score or 0)
    end
    
    ao.send({
      Target = msg.From,
      Action = "Statistics",
      Tags = {
        Status = "Success",
        ["Total-Players"] = tostring(stats.totalPlayers)
      },
      Data = json.encode(stats)
    })
  end
)