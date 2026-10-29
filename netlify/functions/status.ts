// Which integrations are live and whether demo mode is on. Booleans only, never key values.
import { integrationStatus } from '../../engine/adapters'
import { json } from '../lib/http'

export default async (): Promise<Response> => json(integrationStatus(process.env))
