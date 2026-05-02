import { useEffect } from 'react'
import { useLocation } from 'wouter'

export default function OpsGatewayPage() {
  const [, navigate] = useLocation()
  useEffect(() => { navigate('/') }, [navigate])
  return null
}
