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

## Production build

Render (or any static host) uses `.env.production` at **build** time:

```
VITE_API_URL=https://blink-backend-af7x.onrender.com/api
```
