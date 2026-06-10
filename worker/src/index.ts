// Worker placeholder — implementat in Faza 2
import { config } from 'dotenv'
import { resolve } from 'path'

config({ path: resolve(import.meta.dirname, '../../.env') })

console.log('Worker pornit. Scraping implementat in Faza 2.')
