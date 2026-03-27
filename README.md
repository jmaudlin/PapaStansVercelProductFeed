# Papa Stan's Google Merchant Center Feeds

Serverless functions that generate Google Merchant Center XML feeds dynamically,
served with the correct `Content-Type: application/xml` header.

## Feed URLs (after deploy)

| Feed | URL |
|------|-----|
| Primary product feed | `https://papastans-feeds.vercel.app/api/product-feed` |
| Local inventory feed | `https://papastans-feeds.vercel.app/api/local-inventory-feed` |

---

## One-time setup (5 minutes)

### 1. Create a Vercel account
Go to https://vercel.com and sign up (free).

### 2. Install Vercel CLI
```bash
npm install -g vercel
```

### 3. Deploy
```bash
cd papastans-feeds
vercel --prod
```

Follow the prompts — accept all defaults. Vercel will give you a URL like
`https://papastans-feeds.vercel.app`.

### 4. Update Google Merchant Center feeds
- Primary feed URL: `https://papastans-feeds.vercel.app/api/product-feed`
- Local inventory feed URL: `https://papastans-feeds.vercel.app/api/local-inventory-feed`

---

## How it works

- Both functions fetch live product data from `papastans.store/products.json`
- Vercel caches responses for 1 hour (`s-maxage=3600`)
- Google fetches on its own daily schedule — no manual updates ever needed
- To update store code or any settings, edit the constant at the top of the file and redeploy with `vercel --prod`
