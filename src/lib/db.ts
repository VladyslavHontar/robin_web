import Database from 'better-sqlite3'
import path from 'path'
import fs from 'fs'

export type PoolRecord = {
  pair_address: string
  token_x: string
  token_y: string
  bin_step: number
  created_at: string
}

const DB_DIR = path.join(process.cwd(), 'data')
const DB_PATH = path.join(DB_DIR, 'pools.db')

let db: Database.Database | null = null

function getDb(): Database.Database {
  if (db) return db

  // Ensure data directory exists
  if (!fs.existsSync(DB_DIR)) {
    fs.mkdirSync(DB_DIR, { recursive: true })
  }

  db = new Database(DB_PATH)
  db.pragma('journal_mode = WAL')

  db.exec(`
    CREATE TABLE IF NOT EXISTS pools (
      pair_address TEXT PRIMARY KEY,
      token_x TEXT NOT NULL,
      token_y TEXT NOT NULL,
      bin_step INTEGER NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `)

  return db
}

export function getAllPools(): PoolRecord[] {
  return getDb().prepare('SELECT * FROM pools ORDER BY created_at DESC').all() as PoolRecord[]
}

export function addPool(pairAddress: string, tokenX: string, tokenY: string, binStep: number): PoolRecord {
  const db = getDb()
  db.prepare(
    'INSERT OR IGNORE INTO pools (pair_address, token_x, token_y, bin_step) VALUES (?, ?, ?, ?)'
  ).run(pairAddress.toLowerCase(), tokenX.toLowerCase(), tokenY.toLowerCase(), binStep)

  return db.prepare('SELECT * FROM pools WHERE pair_address = ?').get(pairAddress.toLowerCase()) as PoolRecord
}
