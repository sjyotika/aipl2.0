import 'dotenv/config'
import path from 'node:path'
import { defineConfig } from 'prisma/config'
import { config } from 'dotenv'

// Load .env.local since Next.js uses it but Prisma's env() helper only reads .env
config({ path: '.env.local' })

export default defineConfig({
  schema: path.join('prisma', 'schema.prisma'),
  datasource: {
    url: process.env.DATABASE_URL!,
  },
})
