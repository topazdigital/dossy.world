/** @type {import('next').NextConfig} */
const nextConfig = {
  typescript: {
    ignoreBuildErrors: true,
  },
  images: {
    unoptimized: true,
  },
  allowedDevOrigins: [
    '*.replit.dev',
    '*.replit.app',
    '*.spock.replit.dev',
    '*.kirk.replit.dev',
    '*.janeway.replit.dev',
    '*.picard.replit.dev',
    '*.riker.replit.dev',
    '*.worf.replit.dev',
  ],
}

export default nextConfig
