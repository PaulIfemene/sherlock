// Print fresh values for the privacy secrets. Paste them into .env and into Netlify's env settings.
import { randomBytes } from 'node:crypto'

console.log(`PHONE_HASH_SECRET=${randomBytes(32).toString('hex')}`)
console.log(`REPLY_ADDRESS_KEY=${randomBytes(32).toString('base64')}`)
console.log(`WHATSAPP_VERIFY_TOKEN=${randomBytes(16).toString('hex')}`)
