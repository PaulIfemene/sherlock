// Start a Cloudflare quick tunnel to the local dev server (no account needed).
// Prints a https://<random>.trycloudflare.com URL; give it to `npm run greenapi:webhook -- <url>`.
import { existsSync } from 'node:fs'
import { spawn } from 'node:child_process'

const candidates = ['C:/Program Files (x86)/cloudflared/cloudflared.exe', 'C:/Program Files/cloudflared/cloudflared.exe']
const exe = candidates.find((p) => existsSync(p)) ?? 'cloudflared'
spawn(exe, ['tunnel', '--no-autoupdate', '--url', 'http://localhost:5173'], { stdio: 'inherit' })
