# Zoom Clone — Video Conferencing Platform

A full-stack Zoom meeting platform clone built with **Next.js 15**, **FastAPI**, and **PostgreSQL (Neon DB)**. Replicates Zoom's design, user experience, and core meeting workflows.

![Tech Stack](https://img.shields.io/badge/Next.js-15-black) ![FastAPI](https://img.shields.io/badge/FastAPI-0.115-009688) ![PostgreSQL](https://img.shields.io/badge/PostgreSQL-Neon-blue) ![Docker](https://img.shields.io/badge/Docker-Compose-2496ED)

---

## Architecture

```
┌─────────────────┐     HTTP REST     ┌──────────────────┐     asyncpg     ┌─────────────┐
│   Next.js 15    │ ◄──────────────► │   FastAPI        │ ◄────────────► │  Neon DB     │
│   (React 19)    │   localhost:3000  │   (Uvicorn)      │  localhost:8000 │  (PostgreSQL)│
│   App Router    │                  │   Docker         │                │  Cloud       │
└─────────────────┘                  └──────────────────┘                └─────────────┘
```

## Tech Stack

| Layer           | Technology                    | Details                                      |
|-----------------|-------------------------------|----------------------------------------------|
| **Frontend**    | Next.js 15, React 19, TS      | App Router, vanilla CSS, client components   |
| **Backend**     | Python 3.12, FastAPI, Uvicorn | Async endpoints, Pydantic validation         |
| **Database**    | PostgreSQL via Neon DB        | SQLAlchemy async ORM, auto-migration         |
| **Container**   | Docker + Docker Compose       | Backend containerized with hot-reload        |

## Database Schema

```
┌──────────┐     1:N     ┌──────────────┐     1:N     ┌───────────────┐
│  users   │────────────►│   meetings   │────────────►│ participants  │
│          │             │              │             │               │
│ id (PK)  │             │ id (PK)      │             │ id (PK)       │
│ name     │             │ meeting_id   │             │ meeting_id FK │
│ email    │             │ title        │             │ user_id FK    │
│ avatar   │             │ description  │             │ display_name  │
│ created  │             │ host_id (FK) │             │ role          │
└──────────┘             │ status       │             │ is_muted      │
                         │ scheduled_at │             │ is_video_on   │
                         │ duration_min │             │ joined_at     │
                         │ invite_link  │             │ left_at       │
                         │ passcode     │             └───────────────┘
                         │ created_at   │
                         │ ended_at     │
                         └──────────────┘
```

**Tables:**
- **users** — Application users (default user pre-seeded)
- **meetings** — All meetings with status tracking (scheduled/active/ended)
- **participants** — Meeting participants with role-based access and media state

## Features

### Core Features
- ✅ **Landing Dashboard** — Zoom-like UI with sidebar, action cards, meeting lists
- ✅ **Instant Meeting** — One-click meeting creation with auto-generated ID and invite link
- ✅ **Join Meeting** — Join via Meeting ID with display name input and validation
- ✅ **Schedule Meeting** — Title, description, date/time picker, duration selector
- ✅ **Meeting Room** — Dark-themed room with video grid, control bar, timer
- ✅ **Upcoming/Recent Meetings** — Auto-categorized meeting lists with start/copy actions

### Bonus Features
- ✅ **Responsive Design** — Mobile, tablet, and desktop layouts
- ✅ **Host Controls** — Mute all participants, remove participant
- ✅ **Participants Panel** — Live participant list with role indicators
- ✅ **Chat Panel** — In-meeting chat with message history
- ✅ **Sample Data** — Database pre-seeded with realistic meetings

## Setup Instructions

### Prerequisites
- **Node.js** ≥ 18
- **Docker** & **Docker Compose**
- **Neon DB** account (free tier at [neon.tech](https://neon.tech))

### 1. Clone & Configure

```bash
git clone <repo-url>
cd zoom-clone
```

### 2. Setup Backend

```bash
# Copy env and add your Neon DB connection string
cp backend/.env.example backend/.env
# Edit backend/.env with your DATABASE_URL
```

**Example `.env`:**
```
DATABASE_URL=postgresql+asyncpg://username:password@ep-xxx.us-east-2.aws.neon.tech/neondb?sslmode=require
FRONTEND_URL=http://localhost:3000
```

### 3. Start Backend (Docker)

```bash
docker compose up --build -d
```

The API will be available at `http://localhost:8000`. Database tables and seed data are created automatically on startup.

### 4. Start Frontend

```bash
cd frontend
npm install
npm run dev
```

The app will be available at `http://localhost:3000`.

### 5. Verify

- Open `http://localhost:3000` — Dashboard should load
- Click "New Meeting" — Creates meeting and enters room
- API docs at `http://localhost:8000/docs` (Swagger UI)

## API Endpoints

| Method   | Endpoint                              | Description                    |
|----------|---------------------------------------|--------------------------------|
| `GET`    | `/api/meetings`                       | List upcoming + recent         |
| `POST`   | `/api/meetings`                       | Create instant meeting         |
| `POST`   | `/api/meetings/schedule`              | Schedule a meeting             |
| `GET`    | `/api/meetings/{meeting_id}`          | Get meeting (validate)         |
| `PATCH`  | `/api/meetings/{meeting_id}`          | Update meeting status          |
| `DELETE` | `/api/meetings/{meeting_id}`          | Delete meeting                 |
| `POST`   | `/api/meetings/{meeting_id}/join`     | Join as participant            |
| `GET`    | `/api/meetings/{meeting_id}/participants` | List participants          |
| `PATCH`  | `/api/participants/{id}`              | Mute/unmute participant        |
| `DELETE` | `/api/participants/{id}`              | Remove participant             |
| `POST`   | `/api/meetings/{meeting_id}/mute-all` | Host: mute all                 |
| `GET`    | `/api/health`                         | Health check                   |

## Assumptions

1. **No Login Required** — A default user ("Dhruv Tiwari", ID=1) is assumed logged in
2. **Simulated Video** — Meeting room uses avatar placeholders (no WebRTC)
3. **Single Server** — No real-time sync between participants (simulated participants)
4. **Neon DB** — PostgreSQL hosted on Neon (replace with any PostgreSQL instance)
5. **Sample Data** — Database is auto-seeded with 3 upcoming and 5 recent meetings

## Project Structure

```
zoom-clone/
├── backend/
│   ├── app/
│   │   ├── main.py           # FastAPI app entry point
│   │   ├── config.py         # Settings (Pydantic)
│   │   ├── database.py       # Async SQLAlchemy setup
│   │   ├── models.py         # ORM models
│   │   ├── schemas.py        # Pydantic schemas
│   │   ├── seed.py           # Database seeder
│   │   └── routers/
│   │       ├── meetings.py   # Meeting CRUD
│   │       └── participants.py # Participant management
│   ├── Dockerfile
│   ├── requirements.txt
│   └── .env
├── frontend/
│   ├── src/
│   │   ├── app/
│   │   │   ├── layout.tsx    # Root layout
│   │   │   ├── page.tsx      # Dashboard
│   │   │   ├── globals.css   # Design system
│   │   │   └── meeting/[id]/page.tsx # Meeting room
│   │   ├── components/       # UI components
│   │   ├── lib/api.ts        # API client
│   │   └── types/index.ts    # TypeScript types
│   └── .env.local
├── docker-compose.yml
└── README.md
```
