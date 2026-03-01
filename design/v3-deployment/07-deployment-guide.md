# Mission 3: Detailed Production Deployment Guide

## 1. Prerequisites & Provisioning
Before initiating the deployment, ensure the following cloud resources are provisioned.

### A. Infrastructure (The "Cloud Hexagon")
*   **Database:** PostgreSQL 16+ with `pgvector` enabled (e.g., AWS RDS, Supabase, or Railway).
*   **Cache/Queue:** Redis 7 (e.g., AWS ElastiCache, Upstash, or Railway).
*   **Hosting:**
    *   **Dashboard:** Next.js optimized platform (Vercel is recommended for RSC performance).
    *   **Worker:** Long-running container host (AWS ECS Fargate, Railway, or Fly.io).

### B. Secrets Manifest
Collect the following keys for the Production Environment Manager:
*   `DATABASE_URL`: Connection string (SSL required).
*   `REDIS_URL`: Connection string (TLS required).
*   `GEMINI_API_KEY`: Google AI credentials.
*   `DEEPSEEK_API_KEY`: DeepSeek AI credentials.
*   `AUTH_SECRET`: Generate via `openssl rand -base64 33`.
*   `NEXTAUTH_URL`: Your production domain (e.g., `https://hn-digest.com`).
*   `RESEND_API_KEY`: For email notifications.

## 2. Step-by-Step Deployment Flow

### Step 1: Database Hardening
1.  Connect to your production Postgres instance.
2.  Enable the vector extension: `CREATE EXTENSION IF NOT EXISTS vector;`.
3.  Run migrations from your local machine (targeted at production):
    `DATABASE_URL=prod_url npm run db:push --workspace=@hn-digest/db`

### Step 2: Container Image Building
We use a multi-arch build strategy to support both local and cloud environments.
```bash
# Build and push to your Registry (ECR/DockerHub)
docker buildx build --platform linux/amd64,linux/arm64
  -t your-repo/hn-worker:latest
  -f worker/Dockerfile.local . --push
```

### Step 3: Deploying the Worker (The Intelligence Engine)
1.  Configure the Worker container in your orchestrator (ECS/Railway).
2.  Set `CONCURRENCY`:
    *   **Local:** 2-3 (To avoid OOM during parallel Next.js builds).
    *   **Cloud:** 5-10 (Dependent on Fargate/Task memory allocation).
3.  Ensure the `trafilatura` Python dependency is installed (handled by our Dockerfile).
4.  Verify the worker connects to Redis by checking for the `[Worker] Listening for Map-Reduce flow...` log.

### Step 4: Deploying the Dashboard (Next.js)
1.  Link your GitHub repository to Vercel/Amplify.
2.  Configure Environment Variables in the UI.
3.  Set the Root Directory to `app/`.
4.  Trigger the build. Vercel will automatically handle the Next.js 15 App Router optimizations.

### Step 5: Initializing the Materialized View
Once the app is live, manually trigger the manifest creation to enable the Calendar UI:
```bash
psql $DATABASE_URL -c "CREATE MATERIALIZED VIEW IF NOT EXISTS digest_manifest AS SELECT DISTINCT date_trunc('day', created_at)::date as digest_date FROM analyses; CREATE UNIQUE INDEX IF NOT EXISTS digest_date_idx ON digest_manifest (digest_date);"
```

## 3. Post-Deployment Verification (The Quality Gates)

### Gate 1: Health Check
Visit `https://your-domain.com/api/health/ready`.
*   **Expected:** `{"status": "ok", "db": "connected", "redis": "connected"}`.

### Gate 2: Smoke Test Ingestion
Trigger a 1-story ingestion to verify the full Map-Reduce cycle in the cloud:
```bash
# Run via temporary task or SSH into worker
npx tsx src/index.ts --enqueue --limit 1
```

### Gate 3: Trace Waterfall
1.  Open your Logging UI (BetterStack/Axiom).
2.  Search for the new story's `traceId`.
3.  Confirm that `gemini-2.0-flash` signals and `deepseek-reasoner` synthesis are logged with correct durations.

## 4. Troubleshooting
*   **OOM Kill on Build:** If Next.js fails to build, increase the Build Instance size or reduce `cpu_count` in `next.config.js`.
*   **Redis Timeout:** Ensure the Worker and Redis are in the same VPC/Internal Network.
*   **LLM 401/403:** Verify API keys in the Secrets Manager (hidden characters like spaces are common issues).
