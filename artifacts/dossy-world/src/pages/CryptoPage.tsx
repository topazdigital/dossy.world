import { useState } from 'react'
import { Link } from 'wouter'
import { motion } from 'framer-motion'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { ArrowLeft, Copy, CheckCheck, Bitcoin, AlertCircle, Sparkles } from 'lucide-react'
import { toast } from 'sonner'

interface CryptoOption {
  name: string
  symbol: string
  network: string
  address: string
  minDeposit: string
  confirmations: number
  color: string
  icon: string
}

const CRYPTO_OPTIONS: CryptoOption[] = [
  {
    name: 'Bitcoin',
    symbol: 'BTC',
    network: 'Bitcoin Network',
    address: (import.meta as any).env.VITE_BTC_ADDRESS || 'bc1q_ADD_YOUR_BTC_ADDRESS',
    minDeposit: '0.0001 BTC',
    confirmations: 3,
    color: 'var(--warning)',
    icon: '₿',
  },
  {
    name: 'USDT',
    symbol: 'USDT',
    network: 'TRC20 (TRON)',
    address: (import.meta as any).env.VITE_USDT_TRC20_ADDRESS || 'T_ADD_YOUR_USDT_TRC20_ADDRESS',
    minDeposit: '10 USDT',
    confirmations: 20,
    color: 'var(--neon-green)',
    icon: '₮',
  },
  {
    name: 'USDT',
    symbol: 'USDT',
    network: 'BEP20 (BSC)',
    address: (import.meta as any).env.VITE_USDT_BEP20_ADDRESS || '0x_ADD_YOUR_BEP20_ADDRESS',
    minDeposit: '10 USDT',
    confirmations: 15,
    color: 'var(--neon-cyan)',
    icon: '₮',
  },
]

function QRCodePlaceholder({ address, color }: { address: string; color: string }) {
  const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=160x160&data=${encodeURIComponent(address)}&bgcolor=1a1a2e&color=${color.replace('#', '')}`
  return (
    <div className="flex items-center justify-center rounded-xl border border-[var(--border)] bg-background/50 p-3">
      <img src={qrUrl} alt="QR Code" className="size-40 rounded-lg" onError={(e) => { (e.target as HTMLImageElement).style.display = 'none' }} />
    </div>
  )
}

export default function CryptoPage() {
  const [copied, setCopied] = useState<string | null>(null)

  const copyAddress = async (address: string, id: string) => {
    try {
      await navigator.clipboard.writeText(address)
      setCopied(id)
      toast.success('Address copied!')
      setTimeout(() => setCopied(null), 2000)
    } catch {
      toast.error('Failed to copy')
    }
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="pointer-events-none fixed inset-0">
        <div className="absolute top-0 left-1/4 h-96 w-96 rounded-full bg-[var(--neon-cyan)]/10 blur-3xl" />
        <div className="absolute bottom-0 right-1/4 h-96 w-96 rounded-full bg-[var(--warning)]/10 blur-3xl" />
      </div>

      <header className="sticky top-0 z-10 border-b border-[var(--border)]/50 bg-[var(--background)]/80 backdrop-blur-lg">
        <div className="mx-auto flex h-14 max-w-3xl items-center gap-4 px-4">
          <Button variant="ghost" size="icon" asChild>
            <Link href="/">
              <ArrowLeft className="size-4" />
            </Link>
          </Button>
          <div className="flex items-center gap-2">
            <Bitcoin className="size-5 text-[var(--warning)]" />
            <h1 className="text-lg font-semibold">Crypto Deposits</h1>
          </div>
        </div>
      </header>

      <main className="relative mx-auto max-w-3xl px-4 py-6">
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} className="mb-6">
          <Card className="border-[var(--warning)]/20 bg-card/50">
            <CardContent className="flex items-start gap-3 p-4">
              <AlertCircle className="mt-0.5 size-5 shrink-0 text-[var(--warning)]" />
              <div className="space-y-1 text-sm">
                <p className="font-semibold">Important — Read before sending</p>
                <ul className="text-muted-foreground list-disc space-y-1 pl-4">
                  <li>Only send the correct cryptocurrency to each address.</li>
                  <li>Deposits are credited after the required confirmations.</li>
                  <li>Minimum amounts apply — smaller deposits may be lost.</li>
                  <li>Always double-check the address before sending.</li>
                </ul>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        <div className="space-y-6">
          {CRYPTO_OPTIONS.map((crypto, index) => (
            <motion.div
              key={`${crypto.symbol}-${crypto.network}`}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.1 }}
            >
              <Card className="border-[var(--border)]/60 bg-card/50">
                <CardHeader className="pb-3">
                  <CardTitle className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div
                        className="flex size-10 items-center justify-center rounded-full text-xl font-bold"
                        style={{ backgroundColor: `${crypto.color}20`, color: crypto.color }}
                      >
                        {crypto.icon}
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-base">{crypto.name}</span>
                          <Badge variant="secondary" className="text-xs">{crypto.symbol}</Badge>
                        </div>
                        <p className="text-muted-foreground text-xs font-normal">{crypto.network}</p>
                      </div>
                    </div>
                    <div className="text-right text-xs text-muted-foreground">
                      <p>Min: {crypto.minDeposit}</p>
                      <p>{crypto.confirmations} confirmations</p>
                    </div>
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex flex-col items-center gap-4 sm:flex-row">
                    <QRCodePlaceholder address={crypto.address} color={crypto.color} />
                    <div className="flex-1 space-y-2 w-full">
                      <p className="text-muted-foreground text-xs font-medium uppercase tracking-wider">Deposit Address</p>
                      <div className="flex items-center gap-2 rounded-lg border border-[var(--border)]/60 bg-background/50 p-3">
                        <p className="min-w-0 flex-1 break-all font-mono text-xs">{crypto.address}</p>
                        <Button
                          size="icon"
                          variant="ghost"
                          className="shrink-0"
                          onClick={() => copyAddress(crypto.address, `${crypto.symbol}-${crypto.network}`)}
                        >
                          {copied === `${crypto.symbol}-${crypto.network}` ? (
                            <CheckCheck className="size-4 text-[var(--neon-green)]" />
                          ) : (
                            <Copy className="size-4" />
                          )}
                        </Button>
                      </div>
                      <p className="text-muted-foreground text-xs">
                        Scan QR code or copy address above. Send only {crypto.symbol} ({crypto.network}) to this address.
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </div>

        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.4 }}
          className="mt-8 text-center"
        >
          <div className="inline-flex items-center gap-2 rounded-xl border border-[var(--border)]/50 bg-card/30 px-4 py-3">
            <Sparkles className="size-4 text-[var(--neon-cyan)]" />
            <p className="text-muted-foreground text-sm">
              Crypto deposits are converted to KES at the live market rate and credited to your balance.
            </p>
          </div>
        </motion.div>
      </main>
    </div>
  )
}
