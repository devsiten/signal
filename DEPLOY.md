# Hussayn Signal - Deployment Guide

## Prerequisites

- Node.js 18+
- Cloudflare account
- Wrangler CLI (`npm install -g wrangler`)
- Phantom or Solflare wallet with SOL

## Backend Setup (Cloudflare Worker)

### 1. Login to Cloudflare

```bash
cd backend
wrangler login
```

### 2. Create D1 Database

```bash
wrangler d1 create hussayn-signal-db
```

Copy the database ID and update `wrangler.toml`:
```toml
[[d1_databases]]
binding = "DB"
database_name = "hussayn-signal-db"
database_id = "YOUR_DATABASE_ID_HERE"
```

### 3. Run Database Migration

```bash
wrangler d1 execute hussayn-signal-db --file=./schema.sql
```

### 4. Create R2 Bucket

```bash
wrangler r2 bucket create hussayn-signal-images
```

### 5. Configure Environment Variables

Update `wrangler.toml`:
```toml
[vars]
ADMIN_WALLETS = "YourWalletAddress1,YourWalletAddress2"
TREASURY_WALLET = "YourTreasuryWalletAddress"
SOLANA_RPC = "https://api.mainnet-beta.solana.com"
PRICE_SOL = "0.5"
SUBSCRIPTION_DAYS = "30"
```

For production secrets:
```bash
wrangler secret put TREASURY_WALLET
```

### 6. Deploy Worker

```bash
npm install
wrangler deploy
```

Note your Worker URL (e.g., `https://hussayn-signal-api.your-subdomain.workers.dev`)

---

## Frontend Setup (Cloudflare Pages)

### 1. Configure Environment

```bash
cd frontend
cp .env.example .env.local
```

Edit `.env.local`:
```
NEXT_PUBLIC_API_URL=https://hussayn-signal-api.your-subdomain.workers.dev
NEXT_PUBLIC_SOLANA_RPC=https://api.mainnet-beta.solana.com
NEXT_PUBLIC_TREASURY_WALLET=YourTreasuryWalletAddress
```

### 2. Install Dependencies

```bash
npm install
```

### 3. Local Development

```bash
npm run dev
```

### 4. Deploy to Cloudflare Pages

Option A: Connect GitHub repo to Cloudflare Pages dashboard

Option B: Manual deploy:
```bash
npm run pages:build
wrangler pages deploy .vercel/output/static --project-name=hussayn-signal
```

### 5. Set Environment Variables in Cloudflare Pages

Go to Pages > Your Project > Settings > Environment Variables

Add:
- `NEXT_PUBLIC_API_URL`
- `NEXT_PUBLIC_SOLANA_RPC`
- `NEXT_PUBLIC_TREASURY_WALLET`

---

## R2 Image Upload Setup

### Option 1: Direct Upload (Recommended)

For production, set up CORS on your R2 bucket and use presigned URLs.

### Option 2: Worker Proxy

Modify the admin upload route to proxy uploads through the Worker.

---

## Custom Domain Setup

### For the API (Worker):
1. Go to Workers & Pages > Your Worker > Settings > Triggers
2. Add Custom Domain

### For the Frontend (Pages):
1. Go to Pages > Your Project > Custom Domains
2. Add your domain

---

## Security Checklist

- [ ] Set strong ADMIN_WALLETS (only your wallets)
- [ ] Use separate TREASURY_WALLET for receiving payments
- [ ] Enable rate limiting on payment endpoints
- [ ] Set up monitoring/alerting
- [ ] Configure CORS origins in response.ts
- [ ] Enable Cloudflare WAF rules

---

## Testing Payments

1. Connect wallet on frontend
2. Click Subscribe
3. Sign the transaction in your wallet
4. Verify subscription activated

For testing on devnet:
- Change SOLANA_RPC to `https://api.devnet.solana.com`
- Use devnet SOL

---

## Maintenance

### Clear Expired Sessions
```sql
DELETE FROM sessions WHERE expires_at < datetime('now');
```

### View Active Subscribers
```sql
SELECT * FROM subscriptions WHERE expires_at > datetime('now');
```

### View Payment History
```sql
SELECT * FROM payments WHERE status = 'completed' ORDER BY completed_at DESC;
```
