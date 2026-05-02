// Database utility for Dossy World
// This uses a simple JSON file storage for demo purposes
// Replace with actual MySQL connection in production

import { promises as fs } from 'fs'
import path from 'path'
import { v4 as uuidv4 } from 'uuid'
// @ts-ignore

const DATA_DIR = path.join(process.cwd(), '.data')
const DB_FILE = path.join(DATA_DIR, 'db.json')

export interface User {
  id: string
  username: string
  email: string | null
  phone: string | null
  // bound_phone: the M-Pesa phone permanently locked to this account on its
  // first successful deposit. Anti-multi-account: a phone can only ever
  // deposit into the account it's bound to.
  bound_phone?: string | null
  password_hash: string
  google_id?: string | null
  avatar_url?: string | null
  balance: number
  is_admin: boolean
  is_bot: boolean
  is_banned: boolean
  created_at: string
  updated_at: string
}

export interface Round {
  id: string
  round_number: number
  vault_cap: number
  profit_percentage: number
  current_amount: number
  status: 'waiting' | 'active' | 'filled' | 'paying' | 'paid' | 'expired' | 'cancelled'
  bot_count: number
  // House-edge fields (server-only — never returned to non-admin clients).
  // will_fill: secret outcome rolled at creation. true = bots will help drive
  //   to full and round will pay out. false = bots will stop at bot_target_pct
  //   and round will silently expire if not filled by real users.
  will_fill: boolean
  bot_target_pct: number  // 0-100. Bots will not push past this % of vault_cap.
  expires_at: string | null  // ISO timestamp when an unfilled vault dies.
  expired_at: string | null
  started_at: string | null
  filled_at: string | null
  paid_at: string | null
  created_at: string
  // Provably-fair (commit/reveal). server_seed is secret until the round ends,
  // server_seed_hash is published the moment the round becomes active so any
  // player can later verify HMAC_SHA256(server_seed, `${id}:${client_seed}:${nonce}`)
  // produced the published outcome.
  server_seed?: string | null
  server_seed_hash?: string | null
  client_seed?: string | null
  fairness_nonce?: number | null
}

export interface Buy {
  id: string
  round_id: string
  user_id: string
  amount: number
  payout_amount: number | null
  is_paid: boolean
  is_bot_buy: boolean
  created_at: string
}

export interface Transaction {
  id: string
  user_id: string
  type: 'deposit' | 'withdrawal' | 'buy' | 'payout' | 'refund' | 'admin_credit' | 'admin_debit'
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

export interface AuditLog {
  id: string
  admin_id: string
  admin_username: string
  action: string                    // e.g. 'settings.update', 'user.ban'
  target_type: string | null        // 'user' | 'round' | 'withdrawal' | 'settings' | null
  target_id: string | null
  details: Record<string, unknown> | null
  created_at: string
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
  rounds: Round[]
  buys: Buy[]
  transactions: Transaction[]
  settings: Setting[]
  bot_names: BotName[]
  withdrawal_requests: WithdrawalRequest[]
  audit_logs?: AuditLog[]
  _round_counter: number
}

const DEFAULT_DB: Database = {
  users: [],
  rounds: [],
  buys: [],
  transactions: [],
  settings: [
    { id: 1, setting_key: 'min_buy_amount', setting_value: '50', description: 'Minimum buy amount in KES', updated_at: new Date().toISOString() },
    { id: 2, setting_key: 'max_buy_amount', setting_value: '5000', description: 'Maximum buy amount in KES', updated_at: new Date().toISOString() },
    { id: 3, setting_key: 'default_vault_cap', setting_value: '10000', description: 'Default vault cap for new rounds', updated_at: new Date().toISOString() },
    { id: 4, setting_key: 'default_profit_percentage', setting_value: '30', description: 'Default profit percentage for new rounds', updated_at: new Date().toISOString() },
    { id: 5, setting_key: 'min_withdrawal', setting_value: '100', description: 'Minimum withdrawal amount', updated_at: new Date().toISOString() },
    { id: 6, setting_key: 'max_withdrawal', setting_value: '70000', description: 'Maximum withdrawal amount', updated_at: new Date().toISOString() },
    { id: 7, setting_key: 'house_edge_percentage', setting_value: '70', description: 'Percent of vaults that secretly will not fill (no payout). Higher = house wins more often. 70 = house wins ~70% of rounds.', updated_at: new Date().toISOString() },
    { id: 14, setting_key: 'max_user_stake_pct_per_round', setting_value: '25', description: 'Max % of the vault cap a single real user may stake in one round. Stops a single player from buying the whole vault. 25 = 25% of cap.', updated_at: new Date().toISOString() },
    { id: 15, setting_key: 'max_ip_stake_pct_per_round', setting_value: '40', description: 'Max % of the vault cap that may be staked from any single IP address (across all accounts) per round. Soft Sybil defense.', updated_at: new Date().toISOString() },
    { id: 8, setting_key: 'vault_lifetime_seconds', setting_value: '90', description: 'How long an unfilled vault lives before it silently expires.', updated_at: new Date().toISOString() },
    { id: 9, setting_key: 'nofill_bot_target_min_pct', setting_value: '50', description: 'Min % of cap bots will push a no-fill vault to.', updated_at: new Date().toISOString() },
    { id: 10, setting_key: 'nofill_bot_target_max_pct', setting_value: '80', description: 'Max % of cap bots will push a no-fill vault to.', updated_at: new Date().toISOString() },
    { id: 11, setting_key: 'payout_cooldown_seconds', setting_value: '5', description: 'Seconds between vault eruption and auto-payout.', updated_at: new Date().toISOString() },
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
    await ensureDefaultAdmin(db)
    return db
  } catch {
    await fs.writeFile(DB_FILE, JSON.stringify(DEFAULT_DB, null, 2))
    const fresh = JSON.parse(JSON.stringify(DEFAULT_DB)) as Database
    await ensureDefaultAdmin(fresh)
    return fresh
  }
}

let cachedAdminHash: string | null = null
async function ensureDefaultAdmin(db: Database): Promise<void> {
  // Check every read so a wiped/rolled-back db file is healed automatically.
  if (db.users.some(u => u.is_admin)) return
  const bcrypt = await import('bcryptjs')
  const password = process.env.ADMIN_DEFAULT_PASSWORD || 'Dossy@Admin2026!'
  // Cache the hash so we don't pay the bcrypt cost on every healing pass.
  if (!cachedAdminHash) cachedAdminHash = await bcrypt.hash(password, 10)
  const admin: User = {
    id: uuidv4(),
    username: 'admin',
    email: 'admin@dossy.world',
    phone: null,
    password_hash: cachedAdminHash,
    balance: 0,
    is_admin: true,
    is_bot: false,
    is_banned: false,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  }
  db.users.push(admin)
  await fs.writeFile(DB_FILE, JSON.stringify(db, null, 2))
  console.log('[db] (Re)seeded default admin user (username: admin)')
}

async function writeDB(db: Database): Promise<void> {
  await ensureDataDir()
  await fs.writeFile(DB_FILE, JSON.stringify(db, null, 2))
}

// User operations
export async function createUser(data: {
  username: string
  email?: string | null
  phone?: string | null
  password_hash: string
  google_id?: string | null
  avatar_url?: string | null
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
    google_id: data.google_id || null,
    avatar_url: data.avatar_url || null,
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

export async function findUserByGoogleId(googleId: string): Promise<User | null> {
  const db = await readDB()
  return db.users.find(u => u.google_id === googleId) || null
}

export async function findUserByUsername(username: string): Promise<User | null> {
  const db = await readDB()
  return db.users.find(u => u.username.toLowerCase() === username.toLowerCase()) || null
}

export async function findUserByEmail(email: string): Promise<User | null> {
  const db = await readDB()
  return db.users.find(u => u.email?.toLowerCase() === email.toLowerCase()) || null
}

function normalizePhoneForLookup(phone: string): string {
  let n = phone.replace(/\D/g, '')
  if (n.startsWith('0')) n = '254' + n.substring(1)
  else if (/^[71]/.test(n)) n = '254' + n
  else if (n.startsWith('+254')) n = n.substring(1)
  return n
}

export async function findUserByPhone(phone: string): Promise<User | null> {
  const db = await readDB()
  const normalizedInput = normalizePhoneForLookup(phone)
  return db.users.find(u => u.phone ? normalizePhoneForLookup(u.phone) === normalizedInput : false) || null
}

export async function findUserById(id: string): Promise<User | null> {
  const db = await readDB()
  return db.users.find(u => u.id === id) || null
}

export async function findUserByIdentifier(identifier: string): Promise<User | null> {
  // Try username first
  let user = await findUserByUsername(identifier)
  if (user) return user
  
  // Try email
  if (identifier.includes('@')) {
    user = await findUserByEmail(identifier)
    if (user) return user
  }
  
  // Try phone
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

// Round operations
export async function createRound(data: {
  vault_cap: number
  profit_percentage: number
  bot_count?: number
  will_fill: boolean
  bot_target_pct: number
  expires_at: string | null
  server_seed?: string | null
  server_seed_hash?: string | null
  client_seed?: string | null
  fairness_nonce?: number | null
}): Promise<Round> {
  const db = await readDB()

  db._round_counter = (db._round_counter || 0) + 1

  const round: Round = {
    id: uuidv4(),
    round_number: db._round_counter,
    vault_cap: data.vault_cap,
    profit_percentage: data.profit_percentage,
    current_amount: 0,
    status: 'waiting',
    bot_count: data.bot_count || 0,
    will_fill: data.will_fill,
    bot_target_pct: data.bot_target_pct,
    expires_at: data.expires_at,
    expired_at: null,
    started_at: null,
    filled_at: null,
    paid_at: null,
    created_at: new Date().toISOString(),
    server_seed: data.server_seed ?? null,
    server_seed_hash: data.server_seed_hash ?? null,
    client_seed: data.client_seed ?? null,
    fairness_nonce: data.fairness_nonce ?? null,
  }

  db.rounds.push(round)
  await writeDB(db)
  return round
}

export async function getActiveRound(): Promise<Round | null> {
  const db = await readDB()
  return db.rounds.find(r => r.status === 'active' || r.status === 'waiting') || null
}

// Strict: only the round currently accepting buys ('active').
export async function getActiveRoundStrict(): Promise<Round | null> {
  const db = await readDB()
  const actives = db.rounds
    .filter(r => r.status === 'active')
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
  return actives[0] || null
}

export async function getNextWaitingRound(): Promise<Round | null> {
  const db = await readDB()
  const waiting = db.rounds
    .filter(r => r.status === 'waiting')
    .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())
  return waiting[0] || null
}

export async function getRoundsByStatus(status: Round['status']): Promise<Round[]> {
  const db = await readDB()
  return db.rounds.filter(r => r.status === status)
}

// Distinct real buyers across all rounds in the last `windowMs` ms.
export async function getRecentRealBuyerCount(windowMs: number): Promise<number> {
  const db = await readDB()
  const cutoff = Date.now() - windowMs
  const userIds = new Set<string>()
  for (const b of db.buys) {
    if (b.is_bot_buy) continue
    if (new Date(b.created_at).getTime() >= cutoff) userIds.add(b.user_id)
  }
  return userIds.size
}

export async function getCurrentRound(): Promise<Round | null> {
  const db = await readDB()
  // Get the most recent non-cancelled round
  const sortedRounds = [...db.rounds]
    .filter(r => r.status !== 'cancelled')
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
  return sortedRounds[0] || null
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

// Buy operations
export async function createBuy(data: {
  round_id: string
  user_id: string
  amount: number
  is_bot_buy?: boolean
}): Promise<Buy> {
  const db = await readDB()
  
  const buy: Buy = {
    id: uuidv4(),
    round_id: data.round_id,
    user_id: data.user_id,
    amount: data.amount,
    payout_amount: null,
    is_paid: false,
    is_bot_buy: data.is_bot_buy || false,
    created_at: new Date().toISOString()
  }
  
  db.buys.push(buy)
  
  // Update round amount
  const roundIndex = db.rounds.findIndex(r => r.id === data.round_id)
  if (roundIndex !== -1) {
    db.rounds[roundIndex].current_amount += data.amount
    
    // Check if vault is filled
    if (db.rounds[roundIndex].current_amount >= db.rounds[roundIndex].vault_cap) {
      db.rounds[roundIndex].status = 'filled'
      db.rounds[roundIndex].filled_at = new Date().toISOString()
    }
  }
  
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

export async function updateBuy(id: string, data: Partial<Buy>): Promise<Buy | null> {
  const db = await readDB()
  const index = db.buys.findIndex(b => b.id === id)
  if (index === -1) return null
  
  db.buys[index] = { ...db.buys[index], ...data }
  await writeDB(db)
  return db.buys[index]
}

// Transaction operations
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

// Settings operations
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

// Bot names operations
export async function getRandomBotName(): Promise<BotName | null> {
  const db = await readDB()
  const activeNames = db.bot_names.filter(bn => bn.is_active)
  if (activeNames.length === 0) return null
  
  const randomIndex = Math.floor(Math.random() * activeNames.length)
  const botName = activeNames[randomIndex]
  
  // Update used count
  const index = db.bot_names.findIndex(bn => bn.id === botName.id)
  db.bot_names[index].used_count++
  await writeDB(db)
  
  return botName
}

export async function getAllBotNames(): Promise<BotName[]> {
  const db = await readDB()
  return db.bot_names
}

// Withdrawal requests
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

// Stats
export async function getStats() {
  const db = await readDB()
  
  const totalUsers = db.users.filter(u => !u.is_bot && !u.is_admin).length
  const totalRounds = db.rounds.length
  const activeRound = db.rounds.find(r => r.status === 'active' || r.status === 'waiting')
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
    activeRound,
    pendingWithdrawals,
    totalVolume,
    todayVolume,
    totalDeposits,
    totalWithdrawals
  }
}

// ============================================================
// Audit log — every admin write action gets recorded here.
// ============================================================
export async function recordAudit(entry: {
  admin_id: string
  admin_username: string
  action: string
  target_type?: string | null
  target_id?: string | null
  details?: Record<string, unknown> | null
}): Promise<AuditLog> {
  const db = await readDB()
  if (!db.audit_logs) db.audit_logs = []
  const log: AuditLog = {
    id: uuidv4(),
    admin_id: entry.admin_id,
    admin_username: entry.admin_username,
    action: entry.action,
    target_type: entry.target_type ?? null,
    target_id: entry.target_id ?? null,
    details: entry.details ?? null,
    created_at: new Date().toISOString(),
  }
  db.audit_logs.push(log)
  // Keep newest 5,000 entries to bound the JSON file size.
  if (db.audit_logs.length > 5000) {
    db.audit_logs = db.audit_logs.slice(-5000)
  }
  await writeDB(db)
  return log
}

export async function getAuditLogs(limit = 200): Promise<AuditLog[]> {
  const db = await readDB()
  const logs = db.audit_logs || []
  return logs
    .slice()
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
    .slice(0, limit)
}
