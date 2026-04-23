// Database utility for Dossy World
// This uses a simple JSON file storage for demo purposes
// Replace with actual MySQL connection in production

import { promises as fs } from 'fs'
import path from 'path'
import { v4 as uuidv4 } from 'uuid'

const DATA_DIR = path.join(process.cwd(), '.data')
const DB_FILE = path.join(DATA_DIR, 'db.json')

export interface User {
  id: string
  username: string
  email: string | null
  phone: string | null
  password_hash: string
  balance: number
  is_admin: boolean
  is_bot: boolean
  is_banned: boolean
  created_at: string
  updated_at: string
}

// NEW: Global game state that syncs across all clients
export interface GameState {
  id: number
  current_round_id: string | null
  phase: 'waiting' | 'filling' | 'eruption' | 'paused'
  phase_started_at: string
  vault_fill_percent: number
  total_invested: number
  vault_target: number
  investor_count: number
  next_eruption_target: number
  is_paused: boolean
  last_tick_at: string
}

export interface Round {
  id: string
  round_number: number
  vault_target: number
  profit_percentage: number
  total_invested: number
  final_fill_percent: number
  status: 'active' | 'completed' | 'cancelled'
  investor_count: number
  bot_investor_count: number
  real_investor_count: number
  total_payout: number
  started_at: string
  erupted_at: string | null
  paid_at: string | null
  created_at: string
}

export interface Buy {
  id: string
  round_id: string
  user_id: string
  amount: number
  payout_amount: number | null
  payout_multiplier: number | null
  is_paid: boolean
  is_bot_buy: boolean
  invested_at_percent: number
  created_at: string
  paid_at: string | null
}

export interface Transaction {
  id: string
  user_id: string
  type: 'deposit' | 'withdrawal' | 'invest' | 'payout' | 'refund' | 'admin_credit' | 'admin_debit'
  amount: number
  balance_after: number
  status: 'pending' | 'completed' | 'failed' | 'cancelled'
  mpesa_receipt: string | null
  mpesa_checkout_id: string | null
  phone: string | null
  description: string | null
  reference_id: string | null
  created_at: string
  completed_at: string | null
}

export interface Setting {
  id: number
  setting_key: string
  setting_value: string
  description: string | null
  updated_at: string
}

export interface BotName {
  id: number
  first_name: string
  last_name: string
  used_count: number
  is_active: boolean
}

export interface WithdrawalRequest {
  id: string
  user_id: string
  amount: number
  phone: string
  status: 'pending' | 'approved' | 'processing' | 'completed' | 'rejected' | 'failed'
  admin_notes: string | null
  processed_by: string | null
  mpesa_receipt: string | null
  processed_at: string | null
  created_at: string
}

interface Database {
  users: User[]
  game_state: GameState
  rounds: Round[]
  buys: Buy[]
  transactions: Transaction[]
  settings: Setting[]
  bot_names: BotName[]
  withdrawal_requests: WithdrawalRequest[]
  _round_counter: number
}

const DEFAULT_GAME_STATE: GameState = {
  id: 1,
  current_round_id: null,
  phase: 'waiting',
  phase_started_at: new Date().toISOString(),
  vault_fill_percent: 0,
  total_invested: 0,
  vault_target: 10000,
  investor_count: 0,
  next_eruption_target: 100,
  is_paused: false,
  last_tick_at: new Date().toISOString()
}

const DEFAULT_DB: Database = {
  users: [],
  game_state: DEFAULT_GAME_STATE,
  rounds: [],
  buys: [],
  transactions: [],
  settings: [
    { id: 1, setting_key: 'min_invest_amount', setting_value: '50', description: 'Minimum investment amount in KES', updated_at: new Date().toISOString() },
    { id: 2, setting_key: 'max_invest_amount', setting_value: '5000', description: 'Maximum investment amount in KES', updated_at: new Date().toISOString() },
    { id: 3, setting_key: 'default_vault_target', setting_value: '10000', description: 'Default vault target for new rounds', updated_at: new Date().toISOString() },
    { id: 4, setting_key: 'default_profit_percentage', setting_value: '30', description: 'Default profit percentage for payouts', updated_at: new Date().toISOString() },
    { id: 5, setting_key: 'min_withdrawal', setting_value: '100', description: 'Minimum withdrawal amount', updated_at: new Date().toISOString() },
    { id: 6, setting_key: 'max_withdrawal', setting_value: '70000', description: 'Maximum withdrawal amount', updated_at: new Date().toISOString() },
    { id: 7, setting_key: 'waiting_duration_seconds', setting_value: '5', description: 'Seconds to wait before filling starts', updated_at: new Date().toISOString() },
    { id: 8, setting_key: 'bots_enabled', setting_value: 'true', description: 'Enable bot investors', updated_at: new Date().toISOString() },
    { id: 9, setting_key: 'bot_activity_level', setting_value: 'medium', description: 'Bot activity level: low, medium, high', updated_at: new Date().toISOString() },
    { id: 10, setting_key: 'min_real_users_for_bot_reduction', setting_value: '5', description: 'Reduce bot activity when this many real users are investing', updated_at: new Date().toISOString() },
    { id: 11, setting_key: 'system_paused', setting_value: 'false', description: 'Pause the entire system', updated_at: new Date().toISOString() },
  ],
  bot_names: [
    { id: 1, first_name: 'James', last_name: 'Mwangi', used_count: 0, is_active: true },
    { id: 2, first_name: 'Mary', last_name: 'Wanjiku', used_count: 0, is_active: true },
    { id: 3, first_name: 'John', last_name: 'Kamau', used_count: 0, is_active: true },
    { id: 4, first_name: 'Grace', last_name: 'Njeri', used_count: 0, is_active: true },
    { id: 5, first_name: 'Peter', last_name: 'Ochieng', used_count: 0, is_active: true },
    { id: 6, first_name: 'Faith', last_name: 'Akinyi', used_count: 0, is_active: true },
    { id: 7, first_name: 'David', last_name: 'Kipchoge', used_count: 0, is_active: true },
    { id: 8, first_name: 'Sarah', last_name: 'Chebet', used_count: 0, is_active: true },
    { id: 9, first_name: 'Michael', last_name: 'Otieno', used_count: 0, is_active: true },
    { id: 10, first_name: 'Lucy', last_name: 'Muthoni', used_count: 0, is_active: true },
    { id: 11, first_name: 'Joseph', last_name: 'Karanja', used_count: 0, is_active: true },
    { id: 12, first_name: 'Esther', last_name: 'Wambui', used_count: 0, is_active: true },
    { id: 13, first_name: 'Daniel', last_name: 'Kipruto', used_count: 0, is_active: true },
    { id: 14, first_name: 'Ann', last_name: 'Moraa', used_count: 0, is_active: true },
    { id: 15, first_name: 'Samuel', last_name: 'Wekesa', used_count: 0, is_active: true },
    { id: 16, first_name: 'Joyce', last_name: 'Adhiambo', used_count: 0, is_active: true },
    { id: 17, first_name: 'Patrick', last_name: 'Mutua', used_count: 0, is_active: true },
    { id: 18, first_name: 'Caroline', last_name: 'Nyambura', used_count: 0, is_active: true },
    { id: 19, first_name: 'George', last_name: 'Omondi', used_count: 0, is_active: true },
    { id: 20, first_name: 'Agnes', last_name: 'Kemunto', used_count: 0, is_active: true },
    { id: 21, first_name: 'Brian', last_name: 'Kosgei', used_count: 0, is_active: true },
    { id: 22, first_name: 'Mercy', last_name: 'Chepkoech', used_count: 0, is_active: true },
    { id: 23, first_name: 'Kevin', last_name: 'Muchiri', used_count: 0, is_active: true },
    { id: 24, first_name: 'Beatrice', last_name: 'Wangari', used_count: 0, is_active: true },
    { id: 25, first_name: 'Collins', last_name: 'Rotich', used_count: 0, is_active: true },
    { id: 26, first_name: 'Winnie', last_name: 'Auma', used_count: 0, is_active: true },
    { id: 27, first_name: 'Dennis', last_name: 'Ndungu', used_count: 0, is_active: true },
    { id: 28, first_name: 'Sharon', last_name: 'Jepkosgei', used_count: 0, is_active: true },
    { id: 29, first_name: 'Felix', last_name: 'Musyoka', used_count: 0, is_active: true },
    { id: 30, first_name: 'Nancy', last_name: 'Nyawira', used_count: 0, is_active: true },
  ],
  withdrawal_requests: [],
  _round_counter: 0
}

async function ensureDataDir() {
  try {
    await fs.access(DATA_DIR)
  } catch {
    await fs.mkdir(DATA_DIR, { recursive: true })
  }
}

async function readDB(): Promise<Database> {
  await ensureDataDir()
  try {
    const data = await fs.readFile(DB_FILE, 'utf-8')
    const db = JSON.parse(data) as Database
    // Ensure game_state exists for existing databases
    if (!db.game_state) {
      db.game_state = DEFAULT_GAME_STATE
    }
    return db
  } catch {
    await fs.writeFile(DB_FILE, JSON.stringify(DEFAULT_DB, null, 2))
    return DEFAULT_DB
  }
}

async function writeDB(db: Database): Promise<void> {
  await ensureDataDir()
  await fs.writeFile(DB_FILE, JSON.stringify(db, null, 2))
}

// =====================================================
// GAME STATE OPERATIONS (NEW)
// =====================================================

export async function getGameState(): Promise<GameState> {
  const db = await readDB()
  return db.game_state
}

export async function updateGameState(data: Partial<GameState>): Promise<GameState> {
  const db = await readDB()
  db.game_state = { ...db.game_state, ...data, last_tick_at: new Date().toISOString() }
  await writeDB(db)
  return db.game_state
}

export async function resetGameState(): Promise<GameState> {
  const db = await readDB()
  db.game_state = {
    ...DEFAULT_GAME_STATE,
    phase_started_at: new Date().toISOString(),
    last_tick_at: new Date().toISOString()
  }
  await writeDB(db)
  return db.game_state
}

// =====================================================
// USER OPERATIONS
// =====================================================

export async function createUser(data: {
  username: string
  email?: string | null
  phone?: string | null
  password_hash: string
  is_admin?: boolean
  is_bot?: boolean
}): Promise<User> {
  const db = await readDB()
  
  const user: User = {
    id: uuidv4(),
    username: data.username,
    email: data.email || null,
    phone: data.phone || null,
    password_hash: data.password_hash,
    balance: 0,
    is_admin: data.is_admin || false,
    is_bot: data.is_bot || false,
    is_banned: false,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  }
  
  db.users.push(user)
  await writeDB(db)
  return user
}

export async function findUserByUsername(username: string): Promise<User | null> {
  const db = await readDB()
  return db.users.find(u => u.username.toLowerCase() === username.toLowerCase()) || null
}

export async function findUserByEmail(email: string): Promise<User | null> {
  const db = await readDB()
  return db.users.find(u => u.email?.toLowerCase() === email.toLowerCase()) || null
}

export async function findUserByPhone(phone: string): Promise<User | null> {
  const db = await readDB()
  const normalizedPhone = phone.replace(/\D/g, '')
  return db.users.find(u => u.phone?.replace(/\D/g, '') === normalizedPhone) || null
}

export async function findUserById(id: string): Promise<User | null> {
  const db = await readDB()
  return db.users.find(u => u.id === id) || null
}

export async function findUserByIdentifier(identifier: string): Promise<User | null> {
  let user = await findUserByUsername(identifier)
  if (user) return user
  
  if (identifier.includes('@')) {
    user = await findUserByEmail(identifier)
    if (user) return user
  }
  
  user = await findUserByPhone(identifier)
  return user
}

export async function updateUser(id: string, data: Partial<User>): Promise<User | null> {
  const db = await readDB()
  const index = db.users.findIndex(u => u.id === id)
  if (index === -1) return null
  
  db.users[index] = { ...db.users[index], ...data, updated_at: new Date().toISOString() }
  await writeDB(db)
  return db.users[index]
}

export async function updateUserBalance(id: string, amount: number): Promise<User | null> {
  const db = await readDB()
  const index = db.users.findIndex(u => u.id === id)
  if (index === -1) return null
  
  db.users[index].balance = Math.max(0, db.users[index].balance + amount)
  db.users[index].updated_at = new Date().toISOString()
  await writeDB(db)
  return db.users[index]
}

export async function getAllUsers(includeBotsAdmin = false): Promise<User[]> {
  const db = await readDB()
  if (includeBotsAdmin) return db.users
  return db.users.filter(u => !u.is_bot && !u.is_admin)
}

// =====================================================
// ROUND OPERATIONS
// =====================================================

export async function createRound(data: {
  vault_target: number
  profit_percentage: number
}): Promise<Round> {
  const db = await readDB()
  
  db._round_counter = (db._round_counter || 0) + 1
  
  const round: Round = {
    id: uuidv4(),
    round_number: db._round_counter,
    vault_target: data.vault_target,
    profit_percentage: data.profit_percentage,
    total_invested: 0,
    final_fill_percent: 0,
    status: 'active',
    investor_count: 0,
    bot_investor_count: 0,
    real_investor_count: 0,
    total_payout: 0,
    started_at: new Date().toISOString(),
    erupted_at: null,
    paid_at: null,
    created_at: new Date().toISOString()
  }
  
  db.rounds.push(round)
  
  // Update game state to point to this round
  db.game_state.current_round_id = round.id
  db.game_state.phase = 'waiting'
  db.game_state.phase_started_at = new Date().toISOString()
  db.game_state.vault_fill_percent = 0
  db.game_state.total_invested = 0
  db.game_state.vault_target = data.vault_target
  db.game_state.investor_count = 0
  
  await writeDB(db)
  return round
}

export async function getCurrentRound(): Promise<Round | null> {
  const db = await readDB()
  if (!db.game_state.current_round_id) return null
  return db.rounds.find(r => r.id === db.game_state.current_round_id) || null
}

export async function getRoundById(id: string): Promise<Round | null> {
  const db = await readDB()
  return db.rounds.find(r => r.id === id) || null
}

export async function updateRound(id: string, data: Partial<Round>): Promise<Round | null> {
  const db = await readDB()
  const index = db.rounds.findIndex(r => r.id === id)
  if (index === -1) return null
  
  db.rounds[index] = { ...db.rounds[index], ...data }
  await writeDB(db)
  return db.rounds[index]
}

export async function getAllRounds(): Promise<Round[]> {
  const db = await readDB()
  return [...db.rounds].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
}

export async function getCompletedRounds(limit = 10): Promise<Round[]> {
  const db = await readDB()
  return db.rounds
    .filter(r => r.status === 'completed')
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
    .slice(0, limit)
}

// =====================================================
// BUY (INVESTMENT) OPERATIONS
// =====================================================

export async function createBuy(data: {
  round_id: string
  user_id: string
  amount: number
  is_bot_buy?: boolean
}): Promise<Buy | null> {
  const db = await readDB()
  
  // Get current fill percent at time of investment
  const currentFillPercent = db.game_state.vault_fill_percent
  
  const buy: Buy = {
    id: uuidv4(),
    round_id: data.round_id,
    user_id: data.user_id,
    amount: data.amount,
    payout_amount: null,
    payout_multiplier: null,
    is_paid: false,
    is_bot_buy: data.is_bot_buy || false,
    invested_at_percent: currentFillPercent,
    created_at: new Date().toISOString(),
    paid_at: null
  }
  
  db.buys.push(buy)
  
  // Update round totals
  const roundIndex = db.rounds.findIndex(r => r.id === data.round_id)
  if (roundIndex !== -1) {
    db.rounds[roundIndex].total_invested += data.amount
    db.rounds[roundIndex].investor_count += 1
    if (data.is_bot_buy) {
      db.rounds[roundIndex].bot_investor_count += 1
    } else {
      db.rounds[roundIndex].real_investor_count += 1
    }
  }
  
  // Update game state
  db.game_state.total_invested += data.amount
  db.game_state.investor_count += 1
  db.game_state.vault_fill_percent = Math.min(
    (db.game_state.total_invested / db.game_state.vault_target) * 100,
    100
  )
  db.game_state.last_tick_at = new Date().toISOString()
  
  await writeDB(db)
  return buy
}

export async function getBuysByRound(roundId: string): Promise<(Buy & { user?: User })[]> {
  const db = await readDB()
  const buys = db.buys.filter(b => b.round_id === roundId)
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
  
  return buys.map(buy => ({
    ...buy,
    user: db.users.find(u => u.id === buy.user_id)
  }))
}

export async function getBuysByUser(userId: string): Promise<Buy[]> {
  const db = await readDB()
  return db.buys.filter(b => b.user_id === userId)
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
}

export async function getUnpaidBuysByRound(roundId: string): Promise<Buy[]> {
  const db = await readDB()
  return db.buys.filter(b => b.round_id === roundId && !b.is_paid && !b.is_bot_buy)
}

export async function updateBuy(id: string, data: Partial<Buy>): Promise<Buy | null> {
  const db = await readDB()
  const index = db.buys.findIndex(b => b.id === id)
  if (index === -1) return null
  
  db.buys[index] = { ...db.buys[index], ...data }
  await writeDB(db)
  return db.buys[index]
}

export async function getRealUserCountInRound(roundId: string): Promise<number> {
  const db = await readDB()
  return db.buys.filter(b => b.round_id === roundId && !b.is_bot_buy).length
}

// =====================================================
// TRANSACTION OPERATIONS
// =====================================================

export async function createTransaction(data: {
  user_id: string
  type: Transaction['type']
  amount: number
  balance_after: number
  status?: Transaction['status']
  mpesa_receipt?: string | null
  mpesa_checkout_id?: string | null
  phone?: string | null
  description?: string | null
  reference_id?: string | null
}): Promise<Transaction> {
  const db = await readDB()
  
  const transaction: Transaction = {
    id: uuidv4(),
    user_id: data.user_id,
    type: data.type,
    amount: data.amount,
    balance_after: data.balance_after,
    status: data.status || 'pending',
    mpesa_receipt: data.mpesa_receipt || null,
    mpesa_checkout_id: data.mpesa_checkout_id || null,
    phone: data.phone || null,
    description: data.description || null,
    reference_id: data.reference_id || null,
    created_at: new Date().toISOString(),
    completed_at: data.status === 'completed' ? new Date().toISOString() : null
  }
  
  db.transactions.push(transaction)
  await writeDB(db)
  return transaction
}

export async function getTransactionsByUser(userId: string): Promise<Transaction[]> {
  const db = await readDB()
  return db.transactions.filter(t => t.user_id === userId)
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
}

export async function updateTransaction(id: string, data: Partial<Transaction>): Promise<Transaction | null> {
  const db = await readDB()
  const index = db.transactions.findIndex(t => t.id === id)
  if (index === -1) return null
  
  db.transactions[index] = { ...db.transactions[index], ...data }
  if (data.status === 'completed') {
    db.transactions[index].completed_at = new Date().toISOString()
  }
  await writeDB(db)
  return db.transactions[index]
}

export async function findTransactionByCheckoutId(checkoutId: string): Promise<Transaction | null> {
  const db = await readDB()
  return db.transactions.find(t => t.mpesa_checkout_id === checkoutId) || null
}

// =====================================================
// SETTINGS OPERATIONS
// =====================================================

export async function getSetting(key: string): Promise<string | null> {
  const db = await readDB()
  const setting = db.settings.find(s => s.setting_key === key)
  return setting?.setting_value || null
}

export async function setSetting(key: string, value: string, description?: string): Promise<Setting> {
  const db = await readDB()
  const index = db.settings.findIndex(s => s.setting_key === key)
  
  if (index !== -1) {
    db.settings[index].setting_value = value
    db.settings[index].updated_at = new Date().toISOString()
    if (description) db.settings[index].description = description
  } else {
    db.settings.push({
      id: db.settings.length + 1,
      setting_key: key,
      setting_value: value,
      description: description || null,
      updated_at: new Date().toISOString()
    })
  }
  
  await writeDB(db)
  return db.settings.find(s => s.setting_key === key)!
}

export async function getAllSettings(): Promise<Setting[]> {
  const db = await readDB()
  return db.settings
}

// =====================================================
// BOT NAMES OPERATIONS
// =====================================================

export async function getRandomBotName(): Promise<BotName | null> {
  const db = await readDB()
  const activeNames = db.bot_names.filter(bn => bn.is_active)
  if (activeNames.length === 0) return null
  
  const randomIndex = Math.floor(Math.random() * activeNames.length)
  const botName = activeNames[randomIndex]
  
  const index = db.bot_names.findIndex(bn => bn.id === botName.id)
  db.bot_names[index].used_count++
  await writeDB(db)
  
  return botName
}

export async function getAllBotNames(): Promise<BotName[]> {
  const db = await readDB()
  return db.bot_names
}

// =====================================================
// WITHDRAWAL REQUESTS
// =====================================================

export async function createWithdrawalRequest(data: {
  user_id: string
  amount: number
  phone: string
}): Promise<WithdrawalRequest> {
  const db = await readDB()
  
  const request: WithdrawalRequest = {
    id: uuidv4(),
    user_id: data.user_id,
    amount: data.amount,
    phone: data.phone,
    status: 'pending',
    admin_notes: null,
    processed_by: null,
    mpesa_receipt: null,
    processed_at: null,
    created_at: new Date().toISOString()
  }
  
  db.withdrawal_requests.push(request)
  await writeDB(db)
  return request
}

export async function getWithdrawalRequests(status?: WithdrawalRequest['status']): Promise<(WithdrawalRequest & { user?: User })[]> {
  const db = await readDB()
  let requests = db.withdrawal_requests
  if (status) {
    requests = requests.filter(r => r.status === status)
  }
  
  return requests
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
    .map(req => ({
      ...req,
      user: db.users.find(u => u.id === req.user_id)
    }))
}

export async function updateWithdrawalRequest(id: string, data: Partial<WithdrawalRequest>): Promise<WithdrawalRequest | null> {
  const db = await readDB()
  const index = db.withdrawal_requests.findIndex(r => r.id === id)
  if (index === -1) return null
  
  db.withdrawal_requests[index] = { ...db.withdrawal_requests[index], ...data }
  await writeDB(db)
  return db.withdrawal_requests[index]
}

// =====================================================
// STATS
// =====================================================

export async function getStats() {
  const db = await readDB()
  
  const totalUsers = db.users.filter(u => !u.is_bot && !u.is_admin).length
  const totalRounds = db.rounds.filter(r => r.status === 'completed').length
  const currentRound = db.game_state.current_round_id 
    ? db.rounds.find(r => r.id === db.game_state.current_round_id) 
    : null
  const pendingWithdrawals = db.withdrawal_requests.filter(r => r.status === 'pending').length
  
  const totalVolume = db.buys
    .filter(b => !b.is_bot_buy)
    .reduce((sum, b) => sum + b.amount, 0)
  
  const todayStart = new Date()
  todayStart.setHours(0, 0, 0, 0)
  
  const todayVolume = db.buys
    .filter(b => !b.is_bot_buy && new Date(b.created_at) >= todayStart)
    .reduce((sum, b) => sum + b.amount, 0)
  
  const totalDeposits = db.transactions
    .filter(t => t.type === 'deposit' && t.status === 'completed')
    .reduce((sum, t) => sum + t.amount, 0)
  
  const totalWithdrawals = db.transactions
    .filter(t => t.type === 'withdrawal' && t.status === 'completed')
    .reduce((sum, t) => sum + t.amount, 0)
  
  return {
    totalUsers,
    totalRounds,
    currentRound,
    gameState: db.game_state,
    pendingWithdrawals,
    totalVolume,
    todayVolume,
    totalDeposits,
    totalWithdrawals
  }
}
