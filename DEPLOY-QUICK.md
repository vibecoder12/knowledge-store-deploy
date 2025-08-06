# Quick Railway Deployment Guide

## 🚀 Fast Track to Live URL (15 minutes)

This guide gets you from code to live public URL using Railway + ngrok tunnel.

### Step 1: Database Setup (ngrok tunnel)

Since you have Neo4j running locally, we'll create a tunnel:

```bash
# Install ngrok (if not installed)
# Download from https://ngrok.com/download

# Create tunnel to your local Neo4j
ngrok tcp 7687
```

Copy the `tcp://` URL that ngrok provides (e.g., `tcp://0.tcp.ngrok.io:12345`)

### Step 2: Initialize Git Repository

```bash
cd knowledge-store-deploy
git init
git add .
git commit -m "Initial deployment ready"
```

### Step 3: Push to GitHub

1. Create new repository on GitHub (public or private)
2. Connect and push:

```bash
git remote add origin https://github.com/YOUR_USERNAME/knowledge-store.git
git branch -M main
git push -u origin main
```

### Step 4: Deploy to Railway

1. Go to [railway.app](https://railway.app)
2. Sign up with GitHub
3. Click "New Project" → "Deploy from GitHub repo"
4. Select your repository
5. Railway will auto-detect Node.js and start deployment

### Step 5: Configure Environment Variables

In Railway dashboard, go to Variables tab and add:

```
NEO4J_URI=bolt://0.tcp.ngrok.io:12345  # Your ngrok URL
NEO4J_USERNAME=neo4j
NEO4J_PASSWORD=your_actual_password
OPENAI_API_KEY=your_openai_key
NODE_ENV=production
PORT=3000
```

### Step 6: Test Your Live URL

Railway will provide a URL like `https://knowledge-store-production-abc123.up.railway.app`

Test endpoints:
- `GET /health` - Should return {"status": "ok"}
- `POST /api/agent/query` - Natural language queries

## 🎯 Quick Test

```bash
curl https://your-railway-url.up.railway.app/health
```

## 🔧 Pro Tips

1. **Keep ngrok running**: Your tunnel must stay active
2. **Monitor logs**: Railway provides real-time logs
3. **Custom domain**: Railway supports custom domains
4. **Auto-deploy**: Pushes to main branch auto-deploy

## 🆙 Upgrade Path

Later, you can:
1. Migrate to Neo4j Aura cloud database
2. Add authentication
3. Set up monitoring
4. Add custom domain

## 🆘 Troubleshooting

- **Build fails**: Check Node.js version in railway.json
- **Database connection**: Verify ngrok tunnel is running
- **API errors**: Check Railway logs for details
- **Environment vars**: Ensure all required vars are set

Your live knowledge store should be accessible at the Railway URL within 5-10 minutes!
