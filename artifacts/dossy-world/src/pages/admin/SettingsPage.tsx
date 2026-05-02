import { useState, useEffect, useCallback } from 'react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Settings, RefreshCw, Save, Send } from 'lucide-react'
import { toast } from 'sonner'

interface Setting { id: number; setting_key: string; setting_value: string; description: string | null }

const apiBase = () => (import.meta as any).env.BASE_URL.replace(/\/$/, '')

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

  const handleSave = async () => {
    setIsSaving(true)
    try {
      const res = await fetch(`${apiBase()}/api/admin/settings`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ settings: editedValues }) })
      const data = await res.json()
      if (res.ok) { toast.success(data.message); fetchSettings() } else { toast.error(data.error) }
    } catch { toast.error('Network error') } finally { setIsSaving(false) }
  }

  const handleTestStkPush = async () => {
    if (!testPhone) return toast.error('Enter a phone number first')
    setIsTesting(true)
    try {
      const res = await fetch(`${apiBase()}/api/admin/test-stk-push`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ phone: testPhone, amount: Number(testAmount) || 10 }) })
      const data = await res.json()
      if (res.ok) { toast.success(data.message || 'STK push sent') } else { toast.error(data.error || 'STK push failed') }
    } catch { toast.error('Network error') } finally { setIsTesting(false) }
  }

  if (isLoading) return <div className="flex min-h-[60vh] items-center justify-center"><div className="size-12 animate-spin rounded-full border-4 border-[var(--neon-cyan)] border-t-transparent" /></div>

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div><h1 className="text-2xl font-bold flex items-center gap-2"><Settings className="size-6" />Platform Settings</h1><p className="text-muted-foreground">Configure game parameters and limits</p></div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={fetchSettings}><RefreshCw className="mr-2 size-4" />Refresh</Button>
          <Button onClick={handleSave} disabled={isSaving} className="bg-gradient-to-r from-[var(--neon-cyan)] to-[var(--neon-purple)]">
            {isSaving ? <RefreshCw className="mr-2 size-4 animate-spin" /> : <Save className="mr-2 size-4" />}Save Changes
          </Button>
        </div>
      </div>

      <Card className="border-[var(--border)] bg-card/50">
        <CardHeader><CardTitle>Game Settings</CardTitle><CardDescription>These settings apply to new vaults. Running vaults are not affected unless you use the Dashboard controls.</CardDescription></CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-2">
            {settings.map(setting => (
              <div key={setting.setting_key} className="space-y-2">
                <Label htmlFor={setting.setting_key} className="capitalize">{setting.setting_key.replace(/_/g, ' ')}</Label>
                <Input id={setting.setting_key} value={editedValues[setting.setting_key] || ''} onChange={e => setEditedValues(prev => ({ ...prev, [setting.setting_key]: e.target.value }))} className="bg-background" />
                {setting.description && <p className="text-muted-foreground text-xs">{setting.description}</p>}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card className="border-[var(--border)] bg-card/50">
        <CardHeader><CardTitle>Test STK Push</CardTitle><CardDescription>Send a test M-Pesa STK push to verify the PayHero integration.</CardDescription></CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2"><Label>Phone Number</Label><Input placeholder="0712345678" value={testPhone} onChange={e => setTestPhone(e.target.value)} className="bg-background" /></div>
            <div className="space-y-2"><Label>Amount (KES)</Label><Input type="number" value={testAmount} onChange={e => setTestAmount(e.target.value)} min={1} className="bg-background" /></div>
          </div>
          <Button onClick={handleTestStkPush} disabled={isTesting} variant="outline">
            {isTesting ? <RefreshCw className="mr-2 size-4 animate-spin" /> : <Send className="mr-2 size-4" />}Send Test STK Push
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}
