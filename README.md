# blink_demo

Vite + React wizard for Blink. Local development always talks to the Java API on port 8090.

## Run locally

```powershell
npm install
npm run dev
```

Open `http://127.0.0.1:5173`.

`.env.development` sets `VITE_API_URL=/api`. Vite proxies `/api` to `http://localhost:8090` and returns 503 if Java is not running.

Start the API first, from `Development/Blink-Backend/blink-backend`:

```powershell
$env:JAVA_HOME = "$env:USERPROFILE\tools\jdk-25"
$env:SPRING_PROFILES_ACTIVE = "nodb"
.\mvnw.cmd -DskipTests spring-boot:run
```

Do not use `.env.production` / `VITE_API_URL=https://…onrender.com/api` for local work.

## Deploy on Render

`blink_ui` is a Vite static app. Host it as a **Static Site** (not a Web Service). The GitHub repo is [riya123-ops/blink_ui](https://github.com/riya123-ops/blink_ui); keep **Root Directory** empty.

Vite bakes `VITE_API_URL` in at **build** time. Changing it later requires a rebuild.

### Option A — Dashboard

1. Push `main` to GitHub (this folder is the repo root).
2. [Render Dashboard](https://dashboard.render.com) → **New** → **Static Site**.
3. Connect `riya123-ops/blink_ui` and branch **`main`**.
4. Settings:

   | Field | Value |
   | --- | --- |
   | Name | `blink-ui` |
   | Root Directory | *(leave blank)* |
   | Build Command | `npm ci && npm run build` |
   | Publish Directory | `dist` |

5. Environment variables:

   | Key | Value |
   | --- | --- |
   | `NODE_VERSION` | `22` |
   | `VITE_API_URL` | `https://blink-backend-af7x.onrender.com/api` |

6. **Create Static Site**. After the first deploy, note the URL (`https://blink-ui-xxxx.onrender.com`).
7. Optional: **Redirects/Rewrites** → source `/*`, destination `/index.html`, action **Rewrite**.

### Option B — Blueprint

This repo includes `render.yaml`. In Render: **New** → **Blueprint** → select `riya123-ops/blink_ui`.

### After the site is live

On the **backend** Web Service, set:

```
BLINK_CORS_ORIGINS=http://localhost:5173,https://YOUR-FRONTEND.onrender.com
```

Replace `YOUR-FRONTEND` with the real static-site hostname, then restart/redeploy the API if it does not pick up the env change automatically.

Confirm: open the frontend URL and check that stakeholder roles load from `https://blink-backend-af7x.onrender.com/api/stakeholder-roles`.

## Production build (local)

```powershell
npm run build
npm run preview
```

`.env.production` sets:

```
VITE_API_URL=https://blink-backend-af7x.onrender.com/api
```
