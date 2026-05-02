import { useState, useEffect, useCallback } from 'react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Settings, RefreshCw, Save, Send, Eye, EyeOff, CheckCircle2, XCircle } from 'lucide-react'
import { toast } from 'sonner'

interface Setting { id: number; setting_key: string; setting_value: string; description: string | null }

const apiBase = () => (import.meta as any).env.BASE_URL.replace(/\/$/, '')
const MASKED = '__MASKED__'

const GAME_KEYS = new Set([
  'min_buy_amount','max_buy_amount','default_vault_cap','default_profit_percentage',
  'min_withdrawal','max_withdrawal','house_edge_percentage','vault_lifetime_seconds',
  'nofill_bot_target_min_pct','nofill_bot_target_max_pct','payout_cooldown_seconds',
  'max_user_stake_pct_per_round','max_ip_stake_pct_per_round',
])

interface SectionField {
  key: string
  label: string
  placeholder?: string
  secret?: boolean
  type?: string
  hint?: string
}

const AUTH_SECTION: SectionField[] = [
  { key: 'google_client_id', label: 'Google Client ID', placeholder: 'xxxx.apps.googleusercontent.com', hint: 'From Google Cloud Console → Credentials' },
  { key: 'google_client_secret', label: 'Google Client Secret', placeholder: 'Enter new secret to update', secret: true, hint: 'Keep this confidential — never share it' },
  { key: 'app_base_url', label: 'App Base URL', placeholder: 'https://dossy.world', hint: 'Public URL used as OAuth redirect base' },
]

const PAYHERO_SECTION: SectionField[] = [
  { key: 'payhero_basic_auth', label: 'PayHero Basic Auth Token', placeholder: 'Enter new token to update', secret: true, hint: 'Base64 username:password from PayHero dashboard' },
  { key: 'payhero_channel_id', label: 'PayHero Channel ID', placeholder: 'e.g. 9867233', hint: 'Channel ID linking payments to your M-Pesa till' },
  { key: 'payhero_till_number', label: 'M-Pesa Till / Paybill Number', placeholder: 'e.g. 9867233', hint: 'Displayed to users during deposit' },
  { key: 'payhero_callback_url', label: 'PayHero Callback URL Override', placeholder: 'Leave blank to auto-build from App Base URL', hint: 'Override only if your public URL differs' },
]

const CRYPTO_SECTION: SectionField[] = [
  { key: 'btc_deposit_address', label: 'Bitcoin (BTC) Address', placeholder: 'bc1q...', hint: 'Native SegWit or legacy BTC deposit address' },
  { key: 'usdt_trc20_address', label: 'USDT TRC20 (Tron) Address', placeholder: 'T...', hint: 'Tron network USDT deposit address' },
  { key: 'usdt_bep20_address', label: 'USDT BEP20 (BSC) Address', placeholder: '0x...', hint: 'Binance Smart Chain USDT deposit address' },
]

const SOCIAL_SECTION: SectionField[] = [
  { key: 'whatsapp_group_url', label: 'WhatsApp Group Invite Link', placeholder: 'https://chat.whatsapp.com/...', hint: 'Link opened by the green floating button' },
]

function SecretInput({ value, onChange, placeholder }: { value: string; onChange: (v: string) => void; placeholder?: string }) {
  const [show, setShow] = useState(false)
  const isMasked = value === MASKED
  return (
    <div className="relative">
      <Input
        type={show ? 'text' : 'password'}
        value={isMasked ? '' : value}
        onChange={e => onChange(e.target.value)}
        placeholder={isMasked ? '••••••••  (currently set — type to replace)' : placeholder}
        className="bg-background pr-10"
      />
      <button
        type="button"
        onClick={() => setShow(s => !s)}
        className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
        tabIndex={-1}
      >
        {show ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
      </button>
    </div>
  )
}

function StatusDot({ active }: { active: boolean }) {
  return active
    ? <CheckCircle2 className="size-4 text-emerald-400 shrink-0" />
    : <XCircle className="size-4 text-muted-foreground shrink-0" />
}

function SectionCard({
  title, description, fields, editedValues, onChange,
}: {
  title: string
  description: string
  fields: SectionField[]
  editedValues: Record<string, string>
  onChange: (key: string, val: string) => void
}) {
  return (
    <Card className="border-[var(--border)] bg-card/50">
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid gap-5 md:grid-cols-2">
          {fields.map(f => {
            const val = editedValues[f.key] ?? ''
            const isSet = val === MASKED || (val !== MASKED && val.trim().length > 0)
            return (
              <div key={f.key} className="space-y-2">
                <div className="flex items-center gap-2">
                  <Label htmlFor={f.key}>{f.label}</Label>
                  <StatusDot active={isSet} />
                </div>
                {f.secret ? (
                  <SecretInput value={val} onChange={v => onChange(f.key, v)} placeholder={f.placeholder} />
                ) : (
                  <Input
                    id={f.key}
                    value={val}
                    onChange={e => onChange(f.key, e.target.value)}
                    placeholder={f.placeholder}
                    className="bg-background"
                  />
                )}
                {f.hint && <p className="text-muted-foreground text-xs">{f.hint}</p>}
              </div>
            )
          })}
        </div>
      </CardContent>
    </Card>
  )
}

export default function AdminSettingsPage() {
  const [settings, setSettings] = useState<Setting[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [editedValues, setEditedValues] = useState<Record<string, string>>({})
  const [testPhone, setTestPhone] = useState('')
  const [testAmount, setTestAmount] = useState('10')
  const [isTesting, setIsTesting] = useState(false)

  const fetchSettings = useCallback(async () => {
    try {
      const res = await fetch(`${apiBase()}/api/admin/settings`)
      if (res.ok) {
        const data = await res.json()
        setSettings(data.settings)
        const vals: Record<string, string> = {}
        data.settings.forEach((s: Setting) => { vals[s.setting_key] = s.setting_value })
        setEditedValues(vals)
      }
    } catch {} finally { setIsLoading(false) }
  }, [])

  useEffect(() => { fetchSettings() }, [fetchSettings])

  const handleChange = (key: string, val: string) => {
    setEditedValues(prev => ({ ...prev, [key]: val }))
  }

  const handleSave = async () => {
    setIsSaving(true)
    try {
      const res = await fetch(`${apiBase()}/api/admin/settings`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ settings: editedValues }),
      })
      const data = await res.json()
      if (res.ok) {
        toast.success(data.message || 'Settings saved')
        fetchSettings()
      } else {
        toast.error(data.error || 'Failed to save')
      }
    } catch { toast.error('Network error') } finally { setIsSaving(false) }
  }

  const handleTestStkPush = async () => {
    if (!testPhone) return toast.error('Enter a phone number first')
    setIsTesting(true)
    try {
      const res = await fetch(`${apiBase()}/api/admin/test-stk-push`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone: testPhone, amount: Number(testAmount) || 10 }),
      })
      const data = await res.json()
      if (res.ok) { toast.success(data.message || 'STK push sent') }
      else { toast.error(data.error || 'STK push failed') }
    } catch { toast.error('Network error') } finally { setIsTesting(false) }
  }

  const gameSettings = settings.filter(s => GAME_KEYS.has(s.setting_key))

  if (isLoading) return (
    <div className="flex min-h-[60vh] items-center justify-center">
      <div className="size-12 animate-spin rounded-full border-4 border-[var(--neon-cyan)] border-t-transparent" />
    </div>
  )

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Settings className="size-6" />Platform Settings
          </h1>
          <p className="text-muted-foreground">All changes take effect immediately after saving</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={fetchSettings}><RefreshCw className="mr-2 size-4" />Refresh</Button>
          <Button onClick={handleSave} disabled={isSaving} className="bg-gradient-to-r from-[var(--neon-cyan)] to-[var(--neon-purple)]">
            {isSaving ? <RefreshCw className="mr-2 size-4 animate-spin" /> : <Save className="mr-2 size-4" />}
            Save All Changes
          </Button>
        </div>
      </div>

      {/* Google OAuth */}
      <SectionCard
        title="Google OAuth"
        description="Enable Sign in with Google. Get credentials from Google Cloud Console → APIs & Services → Credentials."
        fields={AUTH_SECTION}
        editedValues={editedValues}
        onChange={handleChange}
      />

      {/* M-Pesa / PayHero */}
      <SectionCard
        title="M-Pesa Payments (PayHero)"
        description="PayHero credentials to process real M-Pesa deposits and withdrawals. Leave blank to run in demo mode."
        fields={PAYHERO_SECTION}
        editedValues={editedValues}
        onChange={handleChange}
      />

      {/* Crypto */}
      <SectionCard
        title="Crypto Deposits"
        description="Wallet addresses shown on the Crypto deposit page. Leave blank to hide that network."
        fields={CRYPTO_SECTION}
        editedValues={editedValues}
        onChange={handleChange}
      />

      {/* Social */}
      <SectionCard
        title="Social & Links"
        description="Community links and branding URLs used throughout the app."
        fields={SOCIAL_SECTION}
        editedValues={editedValues}
        onChange={handleChange}
      />

      {/* Game Settings */}
      <Card className="border-[var(--border)] bg-card/50">
        <CardHeader>
          <CardTitle>Game Settings</CardTitle>
          <CardDescription>These apply to new vaults only. Running vaults are unaffected unless you use the Dashboard controls.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-2">
            {gameSettings.map(s => (
              <div key={s.setting_key} className="space-y-2">
                <Label htmlFor={s.setting_key} className="capitalize">{s.setting_key.replace(/_/g, ' ')}</Label>
                <Input
                  id={s.setting_key}
                  value={editedValues[s.setting_key] ?? ''}
                  onChange={e => handleChange(s.setting_key, e.target.value)}
                  className="bg-background"
                />
                {s.description && <p className="text-muted-foreground text-xs">{s.description}</p>}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Test STK Push */}
      <Card className="border-[var(--border)] bg-card/50">
        <CardHeader>
          <CardTitle>Test STK Push</CardTitle>
          <CardDescription>Send a test M-Pesa STK push to verify the PayHero integration is working.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>Phone Number</Label>
              <Input placeholder="0712345678" value={testPhone} onChange={e => setTestPhone(e.target.value)} className="bg-background" />
            </div>
            <div className="space-y-2">
              <Label>Amount (KES)</Label>
              <Input type="number" value={testAmount} onChange={e => setTestAmount(e.target.value)} min={1} className="bg-background" />
            </div>
          </div>
          <Button onClick={handleTestStkPush} disabled={isTesting} variant="outline">
            {isTesting ? <RefreshCw className="mr-2 size-4 animate-spin" /> : <Send className="mr-2 size-4" />}
            Send Test STK Push
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}
