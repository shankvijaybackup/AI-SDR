# Setup Instructions for AI-SDR

It appears that **Node.js** and **Git** are not currently installed on your system. To work on this project, you will need to install them.

## 1. Install Prerequisites

### Node.js (Required for running the app)
- Download and install from: [https://nodejs.org/](https://nodejs.org/)
- Recommended version: **LTS** (Long Term Support)

### Git (Recommended for version control)
- Download and install from: [https://git-scm.com/downloads](https://git-scm.com/downloads)

## 2. Install Project Dependencies

Once Node.js is installed, open a terminal (PowerShell or Command Prompt) and run the following commands:

### Frontend (Next.js)
```bash
cd "C:\Users\shank\.gemini\antigravity\scratch\AI-SDR\app"
npm install
```

### Backend (Express)
```bash
cd "C:\Users\shank\.gemini\antigravity\scratch\AI-SDR\backend"
npm install
```

## 3. Database Setup (Prisma)
The project uses PostgreSQL. You will need a running Postgres database.
Update the `DATABASE_URL` in `app/.env` (you may need to create this file based on the examples).

Then run:
```bash
cd "C:\Users\shank\.gemini\antigravity\scratch\AI-SDR\app"
npx prisma generate
# If you have a DB running:
# npx prisma db push
```

## 4. Running the App
Follow the instructions in `GETTING_STARTED.md` for starting the servers.
