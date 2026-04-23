// Smart Bot System for Dossy World
// Bots are always active when there are few users
// They back off when many real users are investing

import { v4 as uuidv4 } from 'uuid'
import { 
  createUser, 
  createBuy, 
  getRandomBotName, 
  findUserByUsername,
  getSetting,
  type User
} from './db'
import { hashPassword } from './auth'

// Track last bot action time to prevent spam
let lastBotActionTime = 0
const MIN_BOT_INTERVAL_MS = 2000 // Minimum 2 seconds between bot actions

// Bot configuration based on activity level
const BOT_CONFIGS = {
  low: {
    minBuyAmount: 50,
    maxBuyAmount: 500,
    actionChance: 0.1, // 10% chance per tick
    maxBotsPerTick: 1
  },
  medium: {
    minBuyAmount: 100,
    maxBuyAmount: 1000,
    actionChance: 0.25, // 25% chance per tick
    maxBotsPerTick: 2
  },
  high: {
    minBuyAmount: 200,
    maxBuyAmount: 2000,
    actionChance: 0.4, // 40% chance per tick
    maxBotsPerTick: 3
  }
}

// Generate random buy amount with realistic distribution
function randomBuyAmount(min: number, max: number): number {
  const random = Math.random()
  let amount: number
  
  if (random < 0.5) {
    // 50% chance: small buys (lower third)
    const range = (max - min) / 3
    amount = min + Math.floor(Math.random() * range)
  } else if (random < 0.8) {
    // 30% chance: medium buys (middle third)
    const range = (max - min) / 3
    amount = min + range + Math.floor(Math.random() * range)
  } else if (random < 0.95) {
    // 15% chance: larger buys (upper third)
    const range = (max - min) / 3
    amount = min + (range * 2) + Math.floor(Math.random() * range)
  } else {
    // 5% chance: big buys (near max)
    amount = max - Math.floor(Math.random() * (max - min) * 0.1)
  }
  
  // Round to nearest 10
  return Math.round(amount / 10) * 10
}

// Create or get a bot user
async function getOrCreateBot(): Promise<User | null> {
  const botName = await getRandomBotName()
  if (!botName) return null
  
  const username = `${botName.first_name.toLowerCase()}_${botName.last_name.toLowerCase()}_${Math.floor(Math.random() * 1000)}`
  
  // Check if username exists
  const existingUser = await findUserByUsername(username)
  if (existingUser && existingUser.is_bot) {
    return existingUser
  }
  
  // Create new bot user
  const botUser = await createUser({
    username,
    email: null,
    phone: null,
    password_hash: await hashPassword(uuidv4()),
    is_admin: false,
    is_bot: true
  })
  
  return botUser
}

// Get display name for a bot
export function getBotDisplayName(username: string): string {
  const parts = username.split('_')
  if (parts.length >= 2) {
    const firstName = parts[0].charAt(0).toUpperCase() + parts[0].slice(1)
    const lastInitial = parts[1].charAt(0).toUpperCase()
    return `${firstName} ${lastInitial}.`
  }
  return username
}

// Execute a single bot buy
async function executeBotBuy(roundId: string, amount: number, botUser: User): Promise<boolean> {
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

/**
 * Smart bot system that adjusts activity based on real user count
 * - When few real users: bots are very active to fill the vault
 * - When many real users: bots back off and let users fill naturally
 * - Bots never take payouts (they're just for activity simulation)
 */
export async function triggerSmartBots(
  roundId: string, 
  realUserCount: number,
  currentFillPercent: number
): Promise<number> {
  // Check if bots are enabled
  const botsEnabled = (await getSetting('bots_enabled')) === 'true'
  if (!botsEnabled) return 0
  
  // Respect minimum interval between bot actions
  const now = Date.now()
  if (now - lastBotActionTime < MIN_BOT_INTERVAL_MS) {
    return 0
  }
  
  // Get bot activity level setting
  const activityLevel = (await getSetting('bot_activity_level') || 'medium') as keyof typeof BOT_CONFIGS
  const config = BOT_CONFIGS[activityLevel] || BOT_CONFIGS.medium
  
  // Get threshold for reducing bot activity
  const minUsersForReduction = parseInt(await getSetting('min_real_users_for_bot_reduction') || '5')
  
  // Calculate bot activity multiplier based on real user count
  let activityMultiplier = 1.0
  if (realUserCount >= minUsersForReduction) {
    // Reduce bot activity as more real users join
    activityMultiplier = Math.max(0.1, 1 - (realUserCount - minUsersForReduction) * 0.15)
  } else if (realUserCount === 0) {
    // No real users - bots are more active
    activityMultiplier = 1.5
  }
  
  // Also reduce bot activity as vault fills up (let users finish it)
  if (currentFillPercent > 80) {
    activityMultiplier *= 0.3 // 70% reduction near the end
  } else if (currentFillPercent > 60) {
    activityMultiplier *= 0.6 // 40% reduction after 60%
  }
  
  // Calculate effective action chance
  const effectiveChance = config.actionChance * activityMultiplier
  
  // Random check if bots should act this tick
  if (Math.random() > effectiveChance) {
    return 0
  }
  
  // Determine how many bots will act
  const numBots = Math.ceil(Math.random() * config.maxBotsPerTick * activityMultiplier)
  let successfulBuys = 0
  
  for (let i = 0; i < numBots; i++) {
    const botUser = await getOrCreateBot()
    if (!botUser) continue
    
    const amount = randomBuyAmount(config.minBuyAmount, config.maxBuyAmount)
    const success = await executeBotBuy(roundId, amount, botUser)
    
    if (success) {
      successfulBuys++
      lastBotActionTime = Date.now()
    }
    
    // Small delay between multiple bot buys
    if (i < numBots - 1) {
      await new Promise(resolve => setTimeout(resolve, 300 + Math.random() * 500))
    }
  }
  
  return successfulBuys
}

/**
 * Burst activity - triggered for excitement during filling phase
 * Used sparingly for dramatic effect
 */
export async function triggerBotBurst(roundId: string): Promise<number> {
  const numBuys = 3 + Math.floor(Math.random() * 4) // 3-6 buys
  let successfulBuys = 0
  
  for (let i = 0; i < numBuys; i++) {
    const botUser = await getOrCreateBot()
    if (!botUser) continue
    
    const amount = randomBuyAmount(100, 1500)
    const success = await executeBotBuy(roundId, amount, botUser)
    if (success) successfulBuys++
    
    // Quick succession for burst
    await new Promise(resolve => setTimeout(resolve, 200 + Math.random() * 400))
  }
  
  return successfulBuys
}
