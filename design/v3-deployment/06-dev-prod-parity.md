# Mission 3: Dev/Prod Parity Strategy (The Clean Hexagon)

## 1. Philosophical Mandate: 100% Mirroring
The local development environment (`docker-compose`) must be a pixel-perfect replica of the Cloud infrastructure. Any divergence is a technical debt.

## 2. Shared Containerization (Multi-Arch)
*   **Identical Dockerfiles:** We use the same `Dockerfile.production` for local and cloud.
*   **Multi-Arch Builds:** Images are built for both `linux/amd64` (Cloud) and `linux/arm64` (Local Apple Silicon) using Docker Buildx.
*   **Non-Root Consistency:** Both environments run as the `node` user to catch permission issues before deployment.

## 3. Configuration Parity (The Secret Injection)
*   **Local:** Use `.env.local` loaded via Docker Compose.
*   **Cloud:** Use **Infisical** or **AWS Secrets Manager** to inject variables.
*   **Strict Validation:** Both environments use a central `config.ts` that throws an error if a mandatory environment variable is missing at startup.

## 4. Database & Infrastructure Parity
*   **Postgres:** Local Docker image MUST match the exact minor version of AWS RDS/Supabase (currently Postgres 16).
*   **Extensions:** Local Postgres MUST have `pgvector` pre-installed to ensure vector similarity queries behave identically.
*   **Redis:** Local Redis uses the same `7-alpine` version as the cloud provider.

## 5. Networking & URL Parity
*   **Local Hostnames:** Use Docker internal networking names (e.g., `http://db:5432` instead of `localhost:5434`) inside the containers.
*   **Public URL Aliasing:** We will use `NEXTAUTH_URL=http://127.0.0.1:3005` consistently to ensure cookie stability. For complex CORS testing, we can use local domain aliasing via `/etc/hosts` (e.g., `hndigest.local`).

## 6. The CI/CD Bridge
*   **Stage-Gated Validation:** Every GitHub Action run starts by bringing up the **local** `docker-compose.yml` and running the Playwright tests. If it passes there, it is guaranteed to work in the Cloud because the underlying images are identical.
*   **Terraform for Infrastructure:** All cloud resources (RDS, Redis, ECS) are defined in Terraform. Local changes to schema must be reflected in Terraform migration scripts.
