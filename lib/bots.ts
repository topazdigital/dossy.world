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

// Public helper used by the game engine for adaptive bot drips.
export function randomBotBuyAmount(): number {
  return randomBuyAmount()
}

// Public helper to get/create a bot user on demand.
export async function getOrCreateBotUser(): Promise<User | null> {
  return getOrCreateBot()
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

// Nickname-style pools — real players pick weird handles, not "John Smith".
// Bot usernames blend in with real users. We mix prefix + suffix + sometimes
// a number, just like humans do.
const NICK_PREFIXES = [
  'crypto', 'vault', 'mzee', 'kim', 'dossy', 'mafao', 'tycoon', 'nairobi',
  'sultan', 'bantu', 'jaba', 'mtaani', 'simba', 'zawadi', 'kobe', 'safari',
  'msafiri', 'jamhuri', 'baraka', 'shujaa', 'rais', 'mali', 'pesa', 'doll',
  'chapaa', 'ganji', 'dough', 'plug', 'mboss', 'msee', 'sonko', 'ngori',
  'dade', 'guu', 'mzigo', 'bonga', 'team', 'real', 'big', 'lil',
]
const NICK_SUFFIXES = [
  'king', 'queen', 'god', 'boy', 'girl', 'lord', 'master', 'slayer',
  'wizard', 'hunter', 'pro', 'gang', 'squad', 'tz', 'ke', 'mtaa',
  '254', 'jr', 'sr', '_official', 'x', 'z', 'finest', 'baba',
  'mama', 'kibaba', 'papi', 'wa_pesa', 'dollar', 'noir', 'rich',
]

function generateNickname(): string {
  const p = NICK_PREFIXES[Math.floor(Math.random() * NICK_PREFIXES.length)]
  const s = NICK_SUFFIXES[Math.floor(Math.random() * NICK_SUFFIXES.length)]
  // 60% chance to append a number; 30% chance prefix+suffix only; 10% just prefix+digits.
  const r = Math.random()
  if (r < 0.6) return `${p}${s}${Math.floor(Math.random() * 9000) + 100}`
  if (r < 0.9) return `${p}${s}`
  return `${p}${Math.floor(Math.random() * 9000) + 100}`
}

// Create or get a bot user
async function getOrCreateBot(): Promise<User | null> {
  // 70% chance reuse a fresh nickname-style handle; 30% fall back to the
  // first_name+last_name pool just for variety. Either way, the username
  // looks like something a real player would type.
  for (let attempt = 0; attempt < 5; attempt++) {
    let username: string
    if (Math.random() < 0.7) {
      username = generateNickname()
    } else {
      const botName = await getRandomBotName()
      if (!botName) {
        username = generateNickname()
      } else {
        username = `${botName.first_name.toLowerCase()}${botName.last_name.toLowerCase().slice(0, 2)}${Math.floor(Math.random() * 900) + 100}`
      }
    }

    const existing = await findUserByUsername(username)
    if (existing) {
      if (existing.is_bot) return existing
      // Username collision with a real user — try another one.
      continue
    }

    return await createUser({
      username,
      email: null,
      phone: null,
      password_hash: await hashPassword(uuidv4()),
      is_admin: false,
      is_bot: true,
    })
  }
  return null
}

// Display the bot's username verbatim — same as real players.
export function getBotDisplayName(username: string): string {
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
