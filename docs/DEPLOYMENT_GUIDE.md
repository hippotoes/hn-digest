# HN Digest: Comprehensive Deployment Guide

This guide provides step-by-step instructions for deploying the HN Digest ecosystem in both local and production environments.

## 1. Local Deployment (Docker Compose)

The local environment is optimized for development and full-parity testing using Docker.

### Prerequisites
- Docker & Docker Compose (V2)
- Node.js 22+ (for host-side scripts)
- Valid API keys for LLM providers.

### Step-by-Step Instructions
1.  **Environment Setup:**
    Create a `.env` file in the root directory:
    ```bash
    cp .env.example .env
    # Edit .env with your API keys:
    # GEMINI_API_KEY, DEEPSEEK_API_KEY, AUTH_SECRET
    ```
2.  **Start Services:**
    ```bash
    docker compose up -d --build
    ```
3.  **Database Initialization:**
    Enable the `pgvector` extension and push the schema using the workspace command:
    ```bash
    docker compose exec db psql -U postgres -d hndigest -c "CREATE EXTENSION IF NOT EXISTS vector;"
    docker compose exec app npm run db:push --workspace=@hn-digest/db
    ```
4.  **Verification:**
    *   **Dashboard:** Access `http://localhost:3005` and check health at `http://localhost:3005/api/health/ready`.
    *   **Worker Pipeline:** Run a manual scrape to confirm the end-to-end flow:
        ```bash
        docker compose exec worker npm run start --workspace=@hn-digest/worker -- --enqueue
        ```

---

## 2. Remote Production Deployment

Production deployment follows a distributed architecture: Next.js on a serverless platform (e.g., Vercel) and the Worker on a container orchestrator (e.g., AWS ECS, Railway).

### A. Infrastructure Requirements
- **Database:** PostgreSQL 16+ with `pgvector` (e.g., Supabase, RDS).
- **Cache/Queue:** Redis 7 (e.g., Upstash, ElastiCache).
- **App Hosting:** Vercel (recommended for Next.js 15 RSC).
- **Worker Hosting:** Railway, AWS Fargate, or Fly.io (for long-running BullMQ processes).

### B. Secrets Manifest
Configure the following environment variables in your hosting providers:
- `DATABASE_URL`: Production Postgres string (with SSL).
- `REDIS_URL`: Production Redis string (with TLS).
- `GEMINI_API_KEY`: Google AI credentials.
- `DEEPSEEK_API_KEY`: DeepSeek AI credentials.
- `AUTH_SECRET`: Secure random string (`openssl rand -base64 33`).
- `NEXTAUTH_URL`: Your public domain (e.g., `https://hn-digest.com`).
- `RESEND_API_KEY`: For email delivery.

### C. Deployment Steps
1.  **Database Hardening:**
    Connect to your production DB and run:
    ```sql
    CREATE EXTENSION IF NOT EXISTS vector;
    ```
2.  **Schema Migration:**
    Run migrations from your local machine targeting production:
    ```bash
    DATABASE_URL=your_prod_url npm run db:push --workspace=@hn-digest/db
    ```
3.  **Deploy the Worker:**
    Build and push the Docker image using `worker/Dockerfile.local`. Ensure the environment variables are set in the worker's hosting configuration.
4.  **Deploy the App:**
    Connect your GitHub repo to Vercel, set the root directory to `app/`, and provide the environment variables.
5.  **Initialize Materialized Views:**
    Run the following to enable Calendar navigation:
    ```sql
    CREATE MATERIALIZED VIEW IF NOT EXISTS digest_manifest AS
    SELECT DISTINCT date_trunc('day', created_at)::date as digest_date FROM analyses;
    CREATE UNIQUE INDEX IF NOT EXISTS digest_date_idx ON digest_manifest (digest_date);
    ```

### D. Production Quality Gates
- **Health Gate:** `GET /api/health/ready` should return `200 OK`.
- **Ingestion Test:** Run a single-story scrape in the worker to verify the pipeline.
- **Observability:** Check Jaeger (if configured) or your log aggregator for successful trace waterfalls.
