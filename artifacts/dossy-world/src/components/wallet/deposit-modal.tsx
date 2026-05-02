
import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useAuth } from '@/context/auth-context'
import { Loader2, Phone, ArrowRight, CheckCircle2, AlertCircle, Smartphone } from 'lucide-react'
import { toast } from 'sonner'

interface DepositModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

type DepositStep = 'amount' | 'confirm' | 'processing' | 'success' | 'error'

export function DepositModal({ open, onOpenChange }: DepositModalProps) {
  const { user, refreshUser } = useAuth()
  const [step, setStep] = useState<DepositStep>('amount')
  const [amount, setAmount] = useState('')
  const [phone, setPhone] = useState(user?.phone || '')
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState('')

  const numericAmount = parseFloat(amount) || 0
  const quickAmounts = [200, 500, 1000, 2000, 5000]

  const resetModal = () => {
    setStep('amount')
    setAmount('')
    setError('')
  }

  const handleClose = (open: boolean) => {
    if (!open) {
      resetModal()
    }
    onOpenChange(open)
  }

  const handleDeposit = async () => {
    if (numericAmount < 10) {
      setError('Minimum deposit is KES 10')
      return
    }

    if (!phone) {
      setError('Please enter your M-Pesa phone number')
      return
    }

    setIsLoading(true)
    setError('')
    setStep('processing')

    try {
      const response = await fetch('/api/wallet/deposit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ amount: numericAmount, phone })
      })

      const data = await response.json()

      if (response.ok) {
        setStep('success')
        toast.success('STK Push sent! Check your phone.')
        // Refresh user after a short delay (simulating callback)
        setTimeout(() => {
          refreshUser()
        }, 3000)
      } else {
        setError(data.error || 'Deposit failed')
        setStep('error')
      }
    } catch {
      setError('Network error')
      setStep('error')
    } finally {
      setIsLoading(false)
    }
  }

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-KE').format(value)
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="border-primary/20 bg-card sm:max-w-md">
        <div className="bg-neon-green/10 pointer-events-none absolute -top-32 -right-32 h-64 w-64 rounded-full blur-3xl" />
        
        <DialogHeader className="relative">
          <div className="mb-2 flex size-12 items-center justify-center rounded-xl bg-gradient-to-br from-[var(--neon-green)] to-[var(--neon-cyan)]">
            <Smartphone className="text-primary-foreground size-6" />
          </div>
          <DialogTitle className="text-2xl">Deposit via M-Pesa</DialogTitle>
          <DialogDescription>
            Enter amount and complete payment on your phone
          </DialogDescription>
        </DialogHeader>

        <AnimatePresence mode="wait">
          {error && step !== 'error' && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="bg-destructive/10 text-destructive rounded-lg p-3 text-sm"
            >
              {error}
            </motion.div>
          )}
        </AnimatePresence>

        <AnimatePresence mode="wait">
          {step === 'amount' && (
            <motion.div
              key="amount"
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
              className="space-y-4"
            >
              {/* Quick amounts */}
              <div className="flex flex-wrap gap-2">
                {quickAmounts.map((quickAmount) => (
                  <Button
                    key={quickAmount}
                    variant="outline"
                    size="sm"
                    className={`border-border/50 flex-1 transition-all ${
                      numericAmount === quickAmount 
                        ? 'border-neon-green bg-neon-green/10' 
                        : 'hover:border-neon-green/50'
                    }`}
                    onClick={() => setAmount(quickAmount.toString())}
                  >
                    {formatCurrency(quickAmount)}
                  </Button>
                ))}
              </div>

              {/* Amount input */}
              <div className="space-y-2">
                <label className="text-muted-foreground text-sm font-medium">Amount (KES)</label>
                <div className="relative">
                  <span className="text-muted-foreground absolute left-3 top-1/2 -translate-y-1/2 text-sm font-medium">
                    KES
                  </span>
                  <Input
                    type="number"
                    placeholder="Enter amount"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    className="border-border/50 bg-background/50 h-12 pl-12 text-lg"
                    min={10}
                  />
                </div>
              </div>

              {/* Phone input */}
              <div className="space-y-2">
                <label className="text-muted-foreground text-sm font-medium">M-Pesa Phone Number</label>
                <div className="relative">
                  <Phone className="text-muted-foreground absolute left-3 top-1/2 size-4 -translate-y-1/2" />
                  <Input
                    type="tel"
                    placeholder="0712 345 678"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    className="border-border/50 bg-background/50 pl-10"
                  />
                </div>
              </div>

              <Button
                className="w-full bg-gradient-to-r from-[var(--neon-green)] to-[var(--neon-cyan)]"
                disabled={numericAmount < 10 || !phone}
                onClick={() => setStep('confirm')}
              >
                Continue
                <ArrowRight className="size-4" />
              </Button>
            </motion.div>
          )}

          {step === 'confirm' && (
            <motion.div
              key="confirm"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="space-y-4"
            >
              <div className="rounded-lg border border-[var(--border)] bg-[var(--background)]/50 p-4">
                <div className="mb-4 text-center">
                  <p className="text-muted-foreground text-sm">Deposit Amount</p>
                  <p className="neon-text-green text-3xl font-bold">KES {formatCurrency(numericAmount)}</p>
                </div>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Phone</span>
                    <span>{phone}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Method</span>
                    <span>M-Pesa STK Push</span>
                  </div>
                </div>
              </div>

              <p className="text-muted-foreground text-center text-sm">
                You will receive an M-Pesa prompt on your phone. Enter your PIN to complete the deposit.
              </p>

              <div className="flex gap-2">
                <Button variant="outline" className="flex-1" onClick={() => setStep('amount')}>
                  Back
                </Button>
                <Button 
                  className="flex-1 bg-gradient-to-r from-[var(--neon-green)] to-[var(--neon-cyan)]"
                  onClick={handleDeposit}
                  disabled={isLoading}
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="size-4 animate-spin" />
                      Sending...
                    </>
                  ) : (
                    'Send STK Push'
                  )}
                </Button>
              </div>
            </motion.div>
          )}

          {step === 'processing' && (
            <motion.div
              key="processing"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              className="py-8 text-center"
            >
              <div className="mx-auto mb-4 flex size-16 items-center justify-center rounded-full bg-[var(--neon-cyan)]/20">
                <Loader2 className="size-8 animate-spin text-[var(--neon-cyan)]" />
              </div>
              <h3 className="text-lg font-semibold">Sending STK Push...</h3>
              <p className="text-muted-foreground mt-2 text-sm">
                Please wait while we send the payment request to your phone.
              </p>
            </motion.div>
          )}

          {step === 'success' && (
            <motion.div
              key="success"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              className="py-8 text-center"
            >
              <div className="mx-auto mb-4 flex size-16 items-center justify-center rounded-full bg-[var(--neon-green)]/20">
                <CheckCircle2 className="size-8 text-[var(--neon-green)]" />
              </div>
              <h3 className="neon-text-green text-lg font-semibold">STK Push Sent!</h3>
              <p className="text-muted-foreground mt-2 text-sm">
                Check your phone and enter your M-Pesa PIN to complete the deposit of KES {formatCurrency(numericAmount)}.
              </p>
              <Button 
                className="mt-4 w-full" 
                variant="outline"
                onClick={() => handleClose(false)}
              >
                Done
              </Button>
            </motion.div>
          )}

          {step === 'error' && (
            <motion.div
              key="error"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              className="py-8 text-center"
            >
              <div className="bg-destructive/20 mx-auto mb-4 flex size-16 items-center justify-center rounded-full">
                <AlertCircle className="text-destructive size-8" />
              </div>
              <h3 className="text-destructive text-lg font-semibold">Deposit Failed</h3>
              <p className="text-muted-foreground mt-2 text-sm">
                {error || 'Something went wrong. Please try again.'}
              </p>
              <Button 
                className="mt-4 w-full" 
                variant="outline"
                onClick={() => setStep('amount')}
              >
                Try Again
              </Button>
            </motion.div>
          )}
        </AnimatePresence>
      </DialogContent>
    </Dialog>
  )
}
