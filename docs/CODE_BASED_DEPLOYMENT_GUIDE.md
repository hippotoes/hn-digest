# Code-Derived Deployment Guide (HN Digest)

This guide is derived strictly from the analysis of the project's source code, configuration files, and container specifications.

## 1. Local Deployment (Docker-First)

The local environment is orchestrated via Docker Compose, which manages the full lifecycle of the application, including the database, queue, and observability stack.

### Prerequisites
- **Docker & Docker Compose (V2):** Required for infrastructure orchestration.
- **Node.js 22 (LTS):** Required for host-side management scripts.
- **Python 3.11+:** Required for the `trafilatura` scraper bridge.

### Infrastructure Stack (from `docker-compose.yml`)
- **Database:** PostgreSQL 16 with `pgvector` extension (`pgvector/pgvector:pg16`).
- **Cache/Queue:** Redis 7 (`redis:7-alpine`).
- **Observability:**
  - Jaeger (OTLP gRPC/HTTP at ports 4317/4318).
  - Prometheus (Metrics at port 9090).

### Step-by-Step Setup
1.  **Environment Configuration:**
    Create a root `.env` file with the following keys identified in `app` and `worker` environments:
    ```bash
    # LLM API Keys
    GEMINI_API_KEY=your_google_ai_key
    DEEPSEEK_API_KEY=your_deepseek_key

    # Authentication (NextAuth v5)
    AUTH_SECRET=secure_random_string
    NEXTAUTH_URL=http://localhost:3005

    # Notifications
    RESEND_API_KEY=your_resend_key

    # Optional Tracing
    OTEL_EXPORTER_OTLP_ENDPOINT=http://jaeger:4317
    ```

2.  **Start Services:**
    ```bash
    docker compose up -d --build
    ```

3.  **Database Migration:**
    The project uses Drizzle ORM. To ensure correct dependency resolution in the monorepo, follow these steps:
    ```bash
    # 1. Install dependencies from the root
    npm install

    # 2. Push the schema using the workspace script
    npm run db:push --workspace=@hn-digest/db
    ```

4.  **Verification:**
    - **Frontend:** Accessible at `http://localhost:3005`.
    - **Worker:** Logs can be checked via `docker compose logs -f worker`.
    - **Database:** Reachable at `localhost:5434`.
    - **Redis:** Reachable at `localhost:6381`.

---

## 2. Remote Production Deployment

Production deployment requires replicating the service architecture in a distributed environment.

### Service Architecture
- **Web Layer (`app/`):** Next.js 15+ (App Router). Best suited for Vercel, Railway, or AWS Fargate.
- **Worker Layer (`worker/`):** Node.js BullMQ process. Must be a long-running container (not serverless).
- **Database Layer (`packages/db/`):** PostgreSQL 16+ with the `vector` extension enabled.
- **Cache Layer:** Redis 7+ for BullMQ orchestration.

### Required Production Secrets
Based on `app/src/db.ts` and `worker/src/index.ts`:
- `DATABASE_URL`: Full PostgreSQL connection string (must support `pgvector`).
- `REDIS_URL`: Full Redis connection string (e.g., `rediss://...` for TLS).
- `GEMINI_API_KEY`, `DEEPSEEK_API_KEY`: Required for analysis logic.
- `AUTH_SECRET`: For session encryption.
- `NEXTAUTH_URL`: Your production domain.
- `RESEND_API_KEY`: For worker notification tasks.

### Deployment Workflow
1.  **Database Hardening:**
    Ensure `CREATE EXTENSION IF NOT EXISTS vector;` is executed on the production DB before deployment.
2.  **Schema Sync:**
    Execute `npm run db:push --workspace=@hn-digest/db` from a CI/CD pipeline or local environment targeting the production `DATABASE_URL`.
3.  **Deploy App:**
    Build the `app/` using `next build`. Ensure `OTEL_EXPORTER_OTLP_ENDPOINT` is configured if using the observability stack.
4.  **Deploy Worker:**
    The worker should be deployed using the logic found in `worker/Dockerfile.local` but optimized for production (installing `trafilatura` and `lxml_html_clean` via pip).
    - Entry point: `npm start --workspace=@hn-digest/worker`.
5.  **Static Fallback (Optional):**
    If using the static site generator (`generate_daily.py`), it can be deployed to GitHub Pages as configured in `.github/workflows/daily.yml`.

---

## 3. Configuration Details (Inferred)

### Port Mapping Summary
| Service | External Port | Internal Port | Purpose |
| :--- | :--- | :--- | :--- |
| `app` | 3005 | 3000 | Next.js Frontend/API |
| `db` | 5434 | 5432 | Postgres + Vector Store |
| `redis` | 6381 | 6379 | BullMQ Queue |
| `jaeger` | 16686 | 16686 | Tracing UI |
| `prometheus` | 9090 | 9090 | Metrics Dashboard |

### Build Environment
- **Runtime:** Node.js 22-bullseye (Debian)
- **Dependencies:**
  - Python 3 + Pip for scraping.
  - `trafilatura` (Python) for HTML text extraction.
  - `BullMQ` for distributed job management.
