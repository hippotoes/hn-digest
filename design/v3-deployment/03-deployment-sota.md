# Mission 3: Deployment SOTA

## 1. Containerization (Docker SOTA)
*   **Multi-Stage Builds:** Using Alpine or Debian-Slim base images to reduce the attack surface and image size.
*   **Layer Caching:** Optimizing `package.json` copying to ensure fast rebuilds during development.
*   **Non-Root Execution:** Running the `app` and `worker` as a limited `node` user for security.

## 2. Infrastructure Architecture
*   **Database:** **AWS RDS Aurora (Postgres)** or **Supabase**. Must support `pgvector`.
*   **Cache/Queue:** **AWS ElastiCache (Redis)** or **Upstash**.
*   **Next.js Dashboard:** **Vercel** (Global Edge caching) or **AWS Amplify**.
*   **Worker Pool:** **AWS ECS Fargate**. Serverless container execution that scales based on BullMQ queue depth.

## 3. CI/CD Pipeline (GitHub Actions)
*   **Build Gate:** Runs Vitest and Playwright tests on every PR.
*   **Security Gate:** Runs `npm audit` and Docker image scanning (Trivy).
*   **Deploy Gate:** Sequential deployment: `Preview Environment` -> `Staging` -> `Production`.
*   **Blue/Green Deployment:** Using weighted DNS or Load Balancers to ensure zero-downtime updates.

## 4. Secrets Management
*   **Standard:** Never store `.env` in the repository.
*   **Tooling:** **Infisical** or **AWS Secrets Manager**. Secrets are injected at runtime via the environment.
