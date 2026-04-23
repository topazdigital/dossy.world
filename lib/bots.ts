// Bot system for Dossy World
// Creates realistic-looking activity in the game

import { v4 as uuidv4 } from 'uuid'
import { 
  createUser, 
  createBuy, 
  getRandomBotName, 
  findUserByUsername,
  type User,
  type Round
} from './db'
import { hashPassword } from './auth'

// Bot configuration
const BOT_CONFIG = {
  minBuyAmount: 50,
  maxBuyAmount: 2000,
  minDelayMs: 3000,   // 3 seconds minimum between buys
  maxDelayMs: 30000,  // 30 seconds maximum between buys
  burstChance: 0.1,   // 10% chance of burst activity
  burstMinBuys: 3,
  burstMaxBuys: 6
}

// Generate random buy amount
function randomBuyAmount(): number {
  // Weight towards smaller amounts (more realistic)
  const random = Math.random()
  let amount: number
  
  if (random < 0.5) {
    // 50% chance: small buys (50-200)
    amount = 50 + Math.floor(Math.random() * 150)
  } else if (random < 0.8) {
    // 30% chance: medium buys (200-500)
    amount = 200 + Math.floor(Math.random() * 300)
  } else if (random < 0.95) {
    // 15% chance: larger buys (500-1000)
    amount = 500 + Math.floor(Math.random() * 500)
  } else {
    // 5% chance: big buys (1000-2000)
    amount = 1000 + Math.floor(Math.random() * 1000)
  }
  
  // Round to nearest 10
  return Math.round(amount / 10) * 10
}

// Generate random delay between bot actions
function randomDelay(): number {
  return BOT_CONFIG.minDelayMs + Math.floor(Math.random() * (BOT_CONFIG.maxDelayMs - BOT_CONFIG.minDelayMs))
}

// Create or get a bot user
async function getOrCreateBot(): Promise<User | null> {
  const botName = await getRandomBotName()
  if (!botName) return null
  
  const username = `${botName.first_name.toLowerCase()}_${botName.last_name.toLowerCase()}_${Math.floor(Math.random() * 1000)}`
  
  // Check if username exists
  let existingUser = await findUserByUsername(username)
  if (existingUser && existingUser.is_bot) {
    return existingUser
  }
  
  // Create new bot user
  const botUser = await createUser({
    username,
    email: null,
    phone: null,
    password_hash: await hashPassword(uuidv4()), // Random password (bots don't login)
    is_admin: false,
    is_bot: true
  })
  
  return botUser
}

// Get display name for a bot
export function getBotDisplayName(username: string): string {
  // Convert username like "james_mwangi_123" to "James M."
  const parts = username.split('_')
  if (parts.length >= 2) {
    const firstName = parts[0].charAt(0).toUpperCase() + parts[0].slice(1)
    const lastInitial = parts[1].charAt(0).toUpperCase()
    return `${firstName} ${lastInitial}.`
  }
  return username
}

// Schedule bot buys for a round
export interface BotBuy {
  delay: number
  amount: number
  botUser: User
}

export async function scheduleBotBuys(round: Round, botCount: number): Promise<BotBuy[]> {
  if (botCount <= 0) return []
  
  const scheduledBuys: BotBuy[] = []
  const remainingCap = round.vault_cap - round.current_amount
  
  // Calculate how much room we have for bot buys (max 50% of remaining)
  const maxBotTotal = remainingCap * 0.5
  let currentBotTotal = 0
  
  // Distribute buys across the bots
  const buysPerBot = Math.ceil(Math.random() * 3) + 1 // 1-4 buys per bot
  let cumulativeDelay = 0
  
  for (let i = 0; i < botCount; i++) {
    const botUser = await getOrCreateBot()
    if (!botUser) continue
    
    const numBuys = Math.ceil(Math.random() * buysPerBot)
    
    for (let j = 0; j < numBuys; j++) {
      if (currentBotTotal >= maxBotTotal) break
      
      const amount = randomBuyAmount()
      if (currentBotTotal + amount > maxBotTotal) break
      
      cumulativeDelay += randomDelay()
      
      scheduledBuys.push({
        delay: cumulativeDelay,
        amount,
        botUser
      })
      
      currentBotTotal += amount
    }
    
    if (currentBotTotal >= maxBotTotal) break
  }
  
  // Shuffle the scheduled buys for more randomness
  for (let i = scheduledBuys.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [scheduledBuys[i], scheduledBuys[j]] = [scheduledBuys[j], scheduledBuys[i]]
  }
  
  // Reassign delays after shuffle
  let newDelay = 0
  for (const buy of scheduledBuys) {
    newDelay += randomDelay()
    buy.delay = newDelay
  }
  
  return scheduledBuys
}

// Execute a single bot buy
export async function executeBotBuy(roundId: string, amount: number, botUser: User) {
  try {
    await createBuy({
      round_id: roundId,
      user_id: botUser.id,
      amount,
      is_bot_buy: true
    })
    
    return true
  } catch (error) {
    console.error('Bot buy error:', error)
    return false
  }
}

// Burst activity - multiple quick buys
export async function triggerBotBurst(roundId: string): Promise<number> {
  const numBuys = BOT_CONFIG.burstMinBuys + Math.floor(Math.random() * (BOT_CONFIG.burstMaxBuys - BOT_CONFIG.burstMinBuys))
  let successfulBuys = 0
  
  for (let i = 0; i < numBuys; i++) {
    const botUser = await getOrCreateBot()
    if (!botUser) continue
    
    const amount = randomBuyAmount()
    const success = await executeBotBuy(roundId, amount, botUser)
    if (success) successfulBuys++
    
    // Small delay between burst buys
    await new Promise(resolve => setTimeout(resolve, 500 + Math.random() * 1000))
  }
  
  return successfulBuys
}
