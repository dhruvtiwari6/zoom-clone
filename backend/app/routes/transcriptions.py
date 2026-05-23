from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, BackgroundTasks, status
from prisma import Prisma

from app.database import get_db
from app.services.groq import transcribe_audio, summarize_transcript
from app.services.email import send_meeting_minutes

router = APIRouter(prefix="/api", tags=["transcriptions"])

async def process_meeting_minutes(
    meeting_id: str,
    meeting_title: str,
    recipient_email: str,
    file_bytes: bytes,
    filename: str
):
    """Asynchronous pipeline to transcribe, summarize, and email minutes."""
    try:
        print(f"[AI Note-Taker] Initiating pipeline for meeting: {meeting_title} ({meeting_id})")
        
        # Step 1: Transcribe using Groq Whisper-large-v3
        transcript = await transcribe_audio(file_bytes, filename)
        
        # Step 2: Summarize using Llama-3.3-70b-versatile
        summary = await summarize_transcript(transcript)
        
        # Step 3: Format and email report (and save local HTML copy)
        send_meeting_minutes(recipient_email, meeting_title, summary, transcript)
        
        print(f"[AI Note-Taker] Successfully completed pipeline for meeting {meeting_id}!")
    except Exception as e:
        print(f"[AI Note-Taker] Error in background minutes processing for {meeting_id}: {e}")

@router.post(
    "/meetings/{meeting_id}/transcribe",
    status_code=status.HTTP_202_ACCEPTED
)
async def transcribe_meeting(
    meeting_id: str,
    background_tasks: BackgroundTasks,
    file: UploadFile = File(...),
    db: Prisma = Depends(get_db)
):
    """
    Accept meeting audio recording file (.webm) from host client.
    Fires the transcription & summarization pipeline in a background thread.
    """
    meeting = await db.meeting.find_unique(
        where={"meeting_id": meeting_id},
        include={"host": True}
    )
    if not meeting:
        raise HTTPException(status_code=404, detail="Meeting not found")

    # Read binary stream
    file_bytes = await file.read()
    if not file_bytes:
        raise HTTPException(status_code=400, detail="Empty audio recording file uploaded")

    recipient_email = meeting.host.email if meeting.host else "host@example.com"
    meeting_title = meeting.title

    # Register asynchronous task
    background_tasks.add_task(
        process_meeting_minutes,
        meeting_id,
        meeting_title,
        recipient_email,
        file_bytes,
        file.filename or "meeting_audio.webm"
    )

    return {
        "status": "success",
        "message": "Audio recording received. AI Note-Taker processing initialized in background."
    }
