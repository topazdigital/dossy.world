// Seed script to create an admin user
// Run with: npx tsx scripts/seed-admin.ts

import { createUser, findUserByUsername } from '../lib/db'
import { hashPassword } from '../lib/auth'

async function seedAdmin() {
  console.log('Checking for existing admin...')
  
  const existingAdmin = await findUserByUsername('admin')
  
  if (existingAdmin) {
    console.log('Admin user already exists!')
    console.log('Username: admin')
    return
  }
  
  console.log('Creating admin user...')
  
  const admin = await createUser({
    username: 'admin',
    email: 'admin@dossy.world',
    phone: null,
    password_hash: await hashPassword('admin123'),
    is_admin: true,
    is_bot: false
  })
  
  console.log('Admin user created successfully!')
  console.log('Username: admin')
  console.log('Password: admin123')
  console.log('IMPORTANT: Change this password after first login!')
}

seedAdmin().catch(console.error)
