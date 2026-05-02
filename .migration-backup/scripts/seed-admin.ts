// Seed script to create an admin user
// Run with: npx tsx scripts/seed-admin.ts

import { createUser, findUserByUsername } from '../lib/db'
import { hashPassword } from '../lib/auth'

async function seedAdmin() {
  console.log('Checking for existing admin...')
  
  const ADMIN_PASSWORD = 'Dossy@Admin2026!'
  const existingAdmin = await findUserByUsername('admin')

  if (existingAdmin) {
    console.log('Admin user already exists!')
    console.log('Username: admin')
    console.log('Login URL: /ops-control-9f3a2b7c')
    return
  }

  console.log('Creating admin user...')

  await createUser({
    username: 'admin',
    email: 'admin@dossy.world',
    phone: null,
    password_hash: await hashPassword(ADMIN_PASSWORD),
    is_admin: true,
    is_bot: false
  })

  console.log('Admin user created successfully!')
  console.log('Login URL: /ops-control-9f3a2b7c')
  console.log('Username: admin')
  console.log(`Password: ${ADMIN_PASSWORD}`)
  console.log('IMPORTANT: Change this password after first login!')
}

seedAdmin().catch(console.error)
