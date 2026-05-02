"use client"

import { useState, useEffect, useCallback } from 'react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Settings,
  RefreshCw,
  Save,
  ShieldCheck,
  Send,
} from 'lucide-react'
import { toast } from 'sonner'

interface Setting {
  id: number
  setting_key: string
  setting_value: string
  description: string | null
}

export default function AdminSettingsPage() {
  const [settings, setSettings] = useState<Setting[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [editedValues, setEditedValues] = useState<Record<string, string>>({})
  const [testPhone, setTestPhone] = useState('')
  const [testAmount, setTestAmount] = useState('10')
  const [isTesting, setIsTesting] = useState(false)

  const handleTestStkPush = async () => {
    if (!testPhone) {
      toast.error('Enter a phone number first')
      return
    }
    setIsTesting(true)
    try {
      const res = await fetch('/api/admin/test-stk-push', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone: testPhone, amount: Number(testAmount) || 10 }),
      })
      const data = await res.json()
      if (res.ok) {
        toast.success(data.message || 'STK push sent — check the phone')
      } else {
        toast.error(data.error || 'STK push failed')
      }
    } catch {
      toast.error('Network error')
    } finally {
      setIsTesting(false)
    }
  }

  const fetchSettings = useCallback(async () => {
    try {
      const response = await fetch('/api/admin/settings')
      if (response.ok) {
        const data = await response.json()
        setSettings(data.settings)
        const values: Record<string, string> = {}
        data.settings.forEach((s: Setting) => {
          values[s.setting_key] = s.setting_value
        })
        setEditedValues(values)
      }
    } catch (error) {
      console.error('Failed to fetch settings:', error)
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchSettings()
  }, [fetchSettings])

  const handleSave = async () => {
    setIsSaving(true)
    try {
      const response = await fetch('/api/admin/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ settings: editedValues })
      })
      
      const data = await response.json()
      
      if (response.ok) {
        toast.success('Settings saved successfully')
        fetchSettings()
      } else {
        toast.error(data.error || 'Failed to save settings')
      }
    } catch {
      toast.error('Network error')
    } finally {
      setIsSaving(false)
    }
  }

  const getSettingLabel = (key: string) => {
    const labels: Record<string, string> = {
      min_buy_amount: 'Minimum Buy Amount (KES)',
      max_buy_amount: 'Maximum Buy Amount (KES)',
      default_vault_cap: 'Default Vault Cap (KES)',
      default_profit_percentage: 'Default Profit Percentage (%)',
      min_withdrawal: 'Minimum Withdrawal (KES)',
      max_withdrawal: 'Maximum Withdrawal (KES)'
    }
    return labels[key] || key.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())
  }

  if (isLoading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="size-12 animate-spin rounded-full border-4 border-[var(--neon-cyan)] border-t-transparent" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Settings</h1>
          <p className="text-muted-foreground">Configure game parameters</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={fetchSettings}>
            <RefreshCw className="mr-2 size-4" />
            Refresh
          </Button>
          <Button
            onClick={handleSave}
            disabled={isSaving}
            className="bg-gradient-to-r from-[var(--neon-cyan)] to-[var(--neon-purple)]"
          >
            {isSaving ? (
              <>
                <RefreshCw className="mr-2 size-4 animate-spin" />
                Saving...
              </>
            ) : (
              <>
                <Save className="mr-2 size-4" />
                Save Changes
              </>
            )}
          </Button>
        </div>
      </div>

      {/* Settings Cards */}
      <div className="grid gap-6 md:grid-cols-2">
        {/* Buy Limits */}
        <Card className="border-[var(--border)] bg-card/50">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Settings className="size-5 text-[var(--neon-cyan)]" />
              Buy Limits
            </CardTitle>
            <CardDescription>
              Set minimum and maximum buy amounts
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Minimum Buy Amount (KES)</Label>
              <Input
                type="number"
                value={editedValues.min_buy_amount || ''}
                onChange={(e) => setEditedValues(prev => ({ ...prev, min_buy_amount: e.target.value }))}
                className="bg-background"
              />
            </div>
            <div className="space-y-2">
              <Label>Maximum Buy Amount (KES)</Label>
              <Input
                type="number"
                value={editedValues.max_buy_amount || ''}
                onChange={(e) => setEditedValues(prev => ({ ...prev, max_buy_amount: e.target.value }))}
                className="bg-background"
              />
            </div>
          </CardContent>
        </Card>

        {/* Round Defaults */}
        <Card className="border-[var(--border)] bg-card/50">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Settings className="size-5 text-[var(--neon-cyan)]" />
              Round Defaults
            </CardTitle>
            <CardDescription>
              Default values for new rounds
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Default Vault Cap (KES)</Label>
              <Input
                type="number"
                value={editedValues.default_vault_cap || ''}
                onChange={(e) => setEditedValues(prev => ({ ...prev, default_vault_cap: e.target.value }))}
                className="bg-background"
              />
            </div>
            <div className="space-y-2">
              <Label>Default Profit Percentage (%)</Label>
              <Input
                type="number"
                value={editedValues.default_profit_percentage || ''}
                onChange={(e) => setEditedValues(prev => ({ ...prev, default_profit_percentage: e.target.value }))}
                className="bg-background"
              />
            </div>
          </CardContent>
        </Card>

        {/* Withdrawal Limits */}
        <Card className="border-[var(--border)] bg-card/50">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Settings className="size-5 text-[var(--neon-cyan)]" />
              Withdrawal Limits
            </CardTitle>
            <CardDescription>
              Set withdrawal amount restrictions
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Minimum Withdrawal (KES)</Label>
              <Input
                type="number"
                value={editedValues.min_withdrawal || ''}
                onChange={(e) => setEditedValues(prev => ({ ...prev, min_withdrawal: e.target.value }))}
                className="bg-background"
              />
            </div>
            <div className="space-y-2">
              <Label>Maximum Withdrawal (KES)</Label>
              <Input
                type="number"
                value={editedValues.max_withdrawal || ''}
                onChange={(e) => setEditedValues(prev => ({ ...prev, max_withdrawal: e.target.value }))}
                className="bg-background"
              />
            </div>
          </CardContent>
        </Card>

        {/* House Edge & Anti-Abuse */}
        <Card className="border-[var(--border)] bg-card/50">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ShieldCheck className="size-5 text-[var(--neon-cyan)]" />
              House Edge & Anti-Abuse
            </CardTitle>
            <CardDescription>
              Control how often the house wins and stop a single player from buying the entire vault.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>House Edge % (chance vault will NOT pay out)</Label>
              <Input
                type="number"
                min={0}
                max={95}
                value={editedValues.house_edge_percentage || ''}
                onChange={(e) => setEditedValues(prev => ({ ...prev, house_edge_percentage: e.target.value }))}
                className="bg-background"
              />
              <p className="text-xs text-muted-foreground">
                70 = house wins ~70% of rounds. Higher = more profit, lower = more payouts.
              </p>
            </div>
            <div className="space-y-2">
              <Label>Max Single-User Stake % per Round</Label>
              <Input
                type="number"
                min={1}
                max={100}
                value={editedValues.max_user_stake_pct_per_round || ''}
                onChange={(e) => setEditedValues(prev => ({ ...prev, max_user_stake_pct_per_round: e.target.value }))}
                className="bg-background"
              />
              <p className="text-xs text-muted-foreground">
                25 = a single user can stake at most 25% of the vault cap per round.
              </p>
            </div>
          </CardContent>
        </Card>

        {/* PayHero Test STK Push */}
        <Card className="border-[var(--border)] bg-card/50">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Send className="size-5 text-[var(--neon-cyan)]" />
              Test STK Push (PayHero)
            </CardTitle>
            <CardDescription>
              Fire a test M-Pesa STK push to any number. No DB transaction is created.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Phone Number</Label>
              <Input
                placeholder="0712345678"
                value={testPhone}
                onChange={(e) => setTestPhone(e.target.value)}
                className="bg-background"
              />
            </div>
            <div className="space-y-2">
              <Label>Amount (KES)</Label>
              <Input
                type="number"
                min={1}
                value={testAmount}
                onChange={(e) => setTestAmount(e.target.value)}
                className="bg-background"
              />
            </div>
            <Button
              onClick={handleTestStkPush}
              disabled={isTesting}
              className="w-full bg-gradient-to-r from-[var(--neon-cyan)] to-[var(--neon-purple)]"
            >
              {isTesting ? (
                <>
                  <RefreshCw className="mr-2 size-4 animate-spin" />
                  Sending...
                </>
              ) : (
                <>
                  <Send className="mr-2 size-4" />
                  Send Test STK Push
                </>
              )}
            </Button>
          </CardContent>
        </Card>

        {/* All Settings */}
        <Card className="border-[var(--border)] bg-card/50">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Settings className="size-5 text-[var(--neon-cyan)]" />
              All Settings
            </CardTitle>
            <CardDescription>
              Raw view of all settings
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2 text-sm">
              {settings.map(setting => (
                <div key={setting.id} className="flex items-center justify-between rounded border border-[var(--border)] p-2">
                  <span className="text-muted-foreground">{getSettingLabel(setting.setting_key)}</span>
                  <span className="font-mono font-medium">{setting.setting_value}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
