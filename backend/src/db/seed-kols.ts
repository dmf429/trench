import { Pool } from 'pg'
const db = new Pool({ connectionString: process.env.DATABASE_URL })

const KOL_WALLETS = [
  { address: 'ANSMhFpT8RFkXpZGvohFc8EBvn6MRmAHMPT14CiUxRwM', display_name: 'Ansem', twitter_handle: 'blknoiz06', is_verified: true },
  { address: 'GigaDegenWallet1111111111111111111111111111', display_name: 'GigaDegen', twitter_handle: 'GigaDegen', is_verified: true },
]

async function seed() {
  console.log(`Seeding ${KOL_WALLETS.length} KOL wallets...`)
  for (const kol of KOL_WALLETS) {
    await db.query(
      `INSERT INTO kol_wallets (address, display_name, twitter_handle, is_verified, reputation_score)
       VALUES ($1,$2,$3,$4,50) ON CONFLICT (address) DO UPDATE SET
       display_name=EXCLUDED.display_name, twitter_handle=EXCLUDED.twitter_handle`,
      [kol.address, kol.display_name, kol.twitter_handle, kol.is_verified]
    )
    console.log(`  ✓ ${kol.display_name}`)
  }
  await db.end()
  console.log('Done.')
}
seed().catch(err => { console.error(err); process.exit(1) })
