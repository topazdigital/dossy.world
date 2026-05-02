import { useState, useEffect, useCallback } from 'react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { ScrollText, RefreshCw } from 'lucide-react'

interface AuditLog { id: string; admin_username: string; action: string; target_type: string | null; target_id: string | null; details: Record<string, unknown> | null; created_at: string }

const ACTION_COLORS: Record<string, string> = { 'settings.update': 'text-[var(--neon-cyan)]', 'user.ban': 'text-red-400', 'user.unban': 'text-emerald-400', 'user.balance_credit': 'text-emerald-400', 'user.balance_debit': 'text-amber-400', 'withdrawal.approve': 'text-emerald-400', 'withdrawal.reject': 'text-red-400' }

const apiBase = () => (import.meta as any).env.BASE_URL.replace(/\/$/, '')

export default function AdminAuditPage() {
  const [logs, setLogs] = useState<AuditLog[]>([])
  const [isLoading, setIsLoading] = useState(true)

  const fetchLogs = useCallback(async () => {
    setIsLoading(true)
    try {
      const res = await fetch(`${apiBase()}/api/admin/audit`)
      if (res.ok) { const data = await res.json(); setLogs(data.logs || []) }
    } finally { setIsLoading(false) }
  }, [])

  useEffect(() => { fetchLogs() }, [fetchLogs])

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div><h1 className="text-2xl font-bold flex items-center gap-2"><ScrollText className="size-6 text-[var(--neon-cyan)]" />Audit Log</h1><p className="text-muted-foreground">Tamper-evident record of every admin action.</p></div>
        <Button variant="outline" onClick={fetchLogs} disabled={isLoading}><RefreshCw className={`mr-2 size-4 ${isLoading ? 'animate-spin' : ''}`} />Refresh</Button>
      </div>
      <Card className="border-[var(--border)] bg-card/50">
        <CardHeader><CardTitle>Recent Actions</CardTitle><CardDescription>Newest first. Up to 500 entries.</CardDescription></CardHeader>
        <CardContent>
          {logs.length === 0 ? <p className="text-muted-foreground text-sm">{isLoading ? 'Loading…' : 'No admin actions recorded yet.'}</p> : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="text-muted-foreground border-b border-[var(--border)]">
                  <tr><th className="py-2 pr-4">When</th><th className="py-2 pr-4">Admin</th><th className="py-2 pr-4">Action</th><th className="py-2 pr-4">Target</th><th className="py-2">Details</th></tr>
                </thead>
                <tbody>
                  {logs.map(log => (
                    <tr key={log.id} className="border-b border-[var(--border)]/40 align-top">
                      <td className="py-2 pr-4 text-muted-foreground whitespace-nowrap">{new Date(log.created_at).toLocaleString()}</td>
                      <td className="py-2 pr-4 font-medium">{log.admin_username}</td>
                      <td className={`py-2 pr-4 font-mono ${ACTION_COLORS[log.action] || ''}`}>{log.action}</td>
                      <td className="py-2 pr-4 text-xs text-muted-foreground">{log.target_type}{log.target_id ? ` #${log.target_id.slice(0, 8)}` : ''}</td>
                      <td className="py-2 max-w-[200px] truncate font-mono text-xs text-muted-foreground">{log.details ? JSON.stringify(log.details) : '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
