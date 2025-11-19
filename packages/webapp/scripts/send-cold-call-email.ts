#!/usr/bin/env tsx
/**
 * Script to send cold-call emails to club presidents
 * 
 * Usage:
 *   pnpm exec tsx scripts/send-cold-call-email.ts <email> <clubName> <presidentName>
 * 
 * Example:
 *   pnpm exec tsx scripts/send-cold-call-email.ts formand@klub.dk "Herlev Badminton" "Lars Nielsen"
 */

import { sendColdCallEmail } from '../src/lib/auth/email.js'
import { logger } from '../src/lib/utils/logger.js'

async function main() {
  const args = process.argv.slice(2)
  
  if (args.length < 3) {
    console.error('Usage: pnpm exec tsx scripts/send-cold-call-email.ts <email> <clubName> <presidentName>')
    console.error('')
    console.error('Example:')
    console.error('  pnpm exec tsx scripts/send-cold-call-email.ts formand@klub.dk "Herlev Badminton" "Lars Nielsen"')
    process.exit(1)
  }

  const [email, clubName, presidentName] = args

  // Basic email validation
  if (!email.includes('@')) {
    console.error('Error: Invalid email address')
    process.exit(1)
  }

  try {
    console.log(`Sending cold-call email to ${email}...`)
    console.log(`Club: ${clubName}`)
    console.log(`President: ${presidentName}`)
    console.log('')

    await sendColdCallEmail(email, clubName, presidentName)

    console.log('✅ Email sent successfully!')
    console.log('')
    console.log('You can track opens and clicks in Resend dashboard:')
    console.log('https://resend.com/emails')
  } catch (error) {
    console.error('❌ Failed to send email:', error)
    logger.error('Failed to send cold-call email', error)
    process.exit(1)
  }
}

main().catch((error) => {
  console.error('Unexpected error:', error)
  process.exit(1)
})
