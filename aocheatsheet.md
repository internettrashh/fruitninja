\`\`\`text
AO/aos Technical Framework Summary

1. CORE ARCHITECTURE
==================
aos: Operating system layer
ao: Underlying distributed compute platform
Primary Language: Lua
Execution Model: Message-based process system

2. PROCESS STRUCTURE
=================
Each process has:
- Unique Process ID (43 characters)
- Inbox for messages
- Handlers for message processing
- State storage
- Owner permissions

3. GLOBAL VARIABLES & ENVIRONMENT
=============================
Standard Variables:
{
  Inbox: [],      // Array of unhandled messages
  Name: string,   // Process name
  Owner: string,  // Process owner address
  Handlers: {},   // Handler functions
  ao: {           // Core module
    id: string,   // Process ID
    send: function,
    spawn: function
  }
}

4. MESSAGE STRUCTURE
=================
Standard Message Format:
{
  Target: "Process-ID-Here",
  Action: "ActionName",
  Tags: {
    key1: "value1",
    key2: "value2"
  },
  Data: "Message content",
  From: "Sender-Process-ID"
}

5. HANDLER PATTERNS
================
Basic Handler:
\`\`\`lua
Handlers.add(
  "handlerName",
  function(msg) 
    -- Matcher function
    return msg.Action == "DesiredAction"
  end,
  function(msg)
    -- Handler logic
    ao.send({
      Target = msg.From,
      Data = "Response"
    })
  end
)
\`\`\`

Common Pattern Matchers:
\`\`\`lua
-- Match by Action
Handlers.utils.hasMatchingTag("Action", "Transfer")

-- Match by Data
Handlers.utils.hasMatchingData("ping")

-- Match by multiple conditions
function(msg)
  return msg.Action == "Transfer" and msg.Tags.Amount
end
\`\`\`

6. STATE MANAGEMENT
================
Token Balance Example:
\`\`\`lua
Balances = Balances or {
  [ao.id] = 1000000  -- Initial supply
}

-- Update state
Balances[recipient] = (Balances[recipient] or 0) + amount
Balances[sender] = Balances[sender] - amount
\`\`\`

7. BLUEPRINT TEMPLATES
===================
Available Blueprints:
- Token
- Chatroom
- Voting
- Staking

Loading Blueprint:
\`\`\`lua
.load-blueprint token
\`\`\`

8. TOKEN IMPLEMENTATION
====================
Basic Token Structure:
\`\`\`lua
-- State
Balances = Balances or {}
Name = "Token Name"
Ticker = "TKN"
Denomination = 18

-- Transfer Handler
Handlers.add("transfer",
  Handlers.utils.hasMatchingTag("Action", "Transfer"),
  function(msg)
    local qty = tonumber(msg.Tags.Quantity)
    local recipient = msg.Tags.Recipient
    
    if Balances[msg.From] >= qty then
      Balances[msg.From] = Balances[msg.From] - qty
      Balances[recipient] = (Balances[recipient] or 0) + qty
      
      -- Notify parties
      ao.send({
        Target = msg.From,
        Action = "Debit-Notice",
        Tags = { Amount = tostring(qty) }
      })
    end
  end
)
\`\`\`

9. STANDARD PATTERNS
=================
Error Handling:
\`\`\`lua
assert(type(msg.Tags.Quantity) == 'string', 'Quantity is required!')
assert(tonumber(msg.Tags.Quantity) > 0, 'Quantity must be positive!')
\`\`\`

Message Response:
\`\`\`lua
ao.send({
  Target = msg.From,
  Tags = {
    Action = "Response",
    ["Message-Id"] = msg.Id,
    Status = "Success"
  },
  Data = "Operation completed"
})
\`\`\`

10. UTILITY FUNCTIONS
==================
\`\`\`lua
-- JSON handling
local json = require('json')
local encoded = json.encode({key = "value"})
local decoded = json.decode(encoded)

-- Base64
local base64 = require('.base64')
local encoded = base64.encode("string")
local decoded = base64.decode(encoded)

-- Crypto operations
local crypto = require('.crypto')
local hash = crypto.digest.sha256("data").asHex()
\`\`\`

11. COMMON MODULES
===============
Import Pattern:
\`\`\`lua
local json = require('json')
local base64 = require('.base64')
local crypto = require('.crypto')
local utils = require('.utils')
\`\`\`

Module Capabilities:
\`\`\`lua
-- Utils Example
utils.reduce(function(acc, v) return acc + v end, 0, {1,2,3})
utils.map(function(v) return v * 2 end, {1,2,3})
utils.filter(function(v) return v > 2 end, {1,2,3,4})
\`\`\`

12. TESTING PATTERNS
=================
Basic Process Testing:
\`\`\`lua
-- Send test message
Send({ 
  Target = ao.id, 
  Action = "Test",
  Tags = { key = "value" }
})

-- Check response
local response = Inbox[#Inbox]
assert(response.Tags.Status == "Success")
\`\`\``

13. SQLITE DATABASE INTEGRATION
==========================
Database Initialization:
\`\`\`lua
-- Import JSON for data handling
json = require "json"
-- Initialize SQLite database in memory
if not db then
db = require"lsqlite3".open_memory()
end
-- Create table example
db:exec[[
CREATE TABLE IF NOT EXISTS Users (
ID INTEGER PRIMARY KEY AUTOINCREMENT,
Name TEXT NOT NULL,
Email TEXT UNIQUE,
CreatedAt DATETIME DEFAULT CURRENT_TIMESTAMP
)
]]
\`\`\``
14. CRUD Operations Pattern:
==========================
\`\`\`lua
-- Create (Insert)
Handlers.add(
"CreateUser",
Handlers.utils.hasMatchingTag("Action", "CreateUser"),
function(msg)
local userData = json.decode(msg.Data)
local stmt = db:prepare[[
INSERT INTO Users (Name, Email)
VALUES (:name, :email)
]]
stmt:bind_names{
name = userData.name,
email = userData.email
}
local success = stmt:step()
stmt:finalize()
Send({
Target = msg.From,
Data = success and "User created" or "Creation failed"
})
end
)
-- Read (Select)
Handlers.add(
"GetUsers",
Handlers.utils.hasMatchingTag("Action", "GetUsers"),
function(msg)
local users = {}
for row in db:nrows[[SELECT FROM Users]] do
table.insert(users, row)
end
Send({
Target = msg.From,
Data = json.encode(users)
})
end
)
-- Update
Handlers.add(
"UpdateUser",
Handlers.utils.hasMatchingTag("Action", "UpdateUser"),
function(msg)
local userData = json.decode(msg.Data)
local stmt = db:prepare[[
UPDATE Users
SET Name = :name, Email = :email
WHERE ID = :id
]]
stmt:bind_names{
id = userData.id,
name = userData.name,
email = userData.email
}
local success = stmt:step()
stmt:finalize()
Send({
Target = msg.From,
Data = success and "User updated" or "Update failed"
})
end
)
-- Delete
Handlers.add(
"DeleteUser",
Handlers.utils.hasMatchingTag("Action", "DeleteUser"),
function(msg)
local stmt = db:prepare"DELETE FROM Users WHERE ID = :id"
stmt:bind_names{id = msg.Tags.UserID}
local success = stmt:step()
stmt:finalize()
Send({
Target = msg.From,
Data = success and "User deleted" or "Deletion failed"
})
end
)
\`\`\``