"""Database seeder — populates the database with sample data using Prisma."""

import asyncio
from datetime import datetime, timezone, timedelta

from app.database import db
from app.models import generate_meeting_id, generate_passcode


async def seed():
    """Populate database with sample data."""
    # Ensure database is connected
    is_connected = db.is_connected()
    if not is_connected:
        await db.connect()

    # Check if already seeded (look for user with ID 1)
    user = await db.user.find_unique(where={"id": 1})
    if user:
        # Check if meetings are already seeded
        meetings_count = await db.meeting.count()
        if meetings_count > 0:
            print("Database already seeded. Skipping.")
            return

    now = datetime.now(timezone.utc)

    # ─── Create default user ──────────────────────────────
    if not user:
        user = await db.user.create(
            data={
                "name": "Dhruv Tiwari",
                "email": "dhruv.tiwari@example.com",
            }
        )
        print("Created default user.")

    # ─── Create sample upcoming meetings ─────────────────
    upcoming_meetings_data = [
        {
            "title": "Sprint Planning - Q3 Goals",
            "description": "Quarterly sprint planning session with the engineering team",
            "scheduled_at": now + timedelta(hours=2),
            "duration_minutes": 60,
        },
        {
            "title": "Design Review: Dashboard v2",
            "description": "Review new dashboard mockups and gather feedback",
            "scheduled_at": now + timedelta(days=1, hours=3),
            "duration_minutes": 45,
        },
        {
            "title": "1:1 with Engineering Lead",
            "description": "Weekly sync with the engineering team lead",
            "scheduled_at": now + timedelta(days=2, hours=1),
            "duration_minutes": 30,
        },
    ]

    for data in upcoming_meetings_data:
        mid = generate_meeting_id()
        await db.meeting.create(
            data={
                "meeting_id": mid,
                "title": data["title"],
                "description": data["description"],
                "host_id": 1,
                "status": "scheduled",
                "scheduled_at": data["scheduled_at"],
                "duration_minutes": data["duration_minutes"],
                "invite_link": f"http://localhost:3000/meeting/{mid}",
                "passcode": generate_passcode(),
            }
        )

    # ─── Create sample recent (ended) meetings ───────────
    recent_meetings_data = [
        {
            "title": "Team Standup",
            "description": "Daily standup meeting",
            "scheduled_at": now - timedelta(hours=3),
            "ended_at": now - timedelta(hours=2, minutes=45),
            "duration_minutes": 15,
        },
        {
            "title": "Product Roadmap Discussion",
            "description": "Discussing the product roadmap for next quarter",
            "scheduled_at": now - timedelta(days=1, hours=5),
            "ended_at": now - timedelta(days=1, hours=4),
            "duration_minutes": 60,
        },
        {
            "title": "Client Demo - Project Alpha",
            "description": "Demoing the latest features of Project Alpha to the client",
            "scheduled_at": now - timedelta(days=2, hours=2),
            "ended_at": now - timedelta(days=2, hours=1),
            "duration_minutes": 45,
        },
        {
            "title": "Engineering All-Hands",
            "description": "Monthly engineering department meeting",
            "scheduled_at": now - timedelta(days=3, hours=4),
            "ended_at": now - timedelta(days=3, hours=3),
            "duration_minutes": 60,
        },
        {
            "title": "Interview: Senior Frontend Developer",
            "description": "Technical interview round for senior frontend position",
            "scheduled_at": now - timedelta(days=4, hours=6),
            "ended_at": now - timedelta(days=4, hours=5),
            "duration_minutes": 60,
        },
    ]

    for data in recent_meetings_data:
        mid = generate_meeting_id()
        await db.meeting.create(
            data={
                "meeting_id": mid,
                "title": data["title"],
                "description": data["description"],
                "host_id": 1,
                "status": "ended",
                "scheduled_at": data["scheduled_at"],
                "ended_at": data["ended_at"],
                "duration_minutes": data["duration_minutes"],
                "invite_link": f"http://localhost:3000/meeting/{mid}",
                "passcode": generate_passcode(),
            }
        )

    print("✅ Database seeded successfully!")


if __name__ == "__main__":
    asyncio.run(seed())
