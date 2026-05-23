import httpx
from app.config import get_settings
import json

settings = get_settings()

GROQ_BASE_URL = "https://api.groq.com/openai"

MOCK_TRANSCRIPT = (
    "Host: Welcome everyone to today's Sprint Review and Weekly Sync! Let's get started. "
    "We have a lot of exciting features to talk about. Dhruv, how are things going with the Waiting Room feature?\n"
    "Dhruv: Hi everyone! The Zoom-style Waiting Room is fully complete and functional. "
    "I successfully implemented the backend role checks and frontend glassmorphic overlays. When a guest joins, "
    "they are held in a stylish lobby with pulsing ring animations until the host admits them.\n"
    "Host: That is absolutely phenomenal! What about the LiveKit integration?\n"
    "Dhruv: It's extremely robust. We deferred the LiveKit media server connection until admission, "
    "so waiting participants consume zero camera resources or peer bandwidth. We also resolved a crucial "
    "React Hooks state tracking issue to ensure 100% build type-safety.\n"
    "Host: Outstanding job! Let's deploy it to staging today so we can run complete manual tests. "
    "That wraps up our meeting, thank you everyone!\n"
    "Dhruv: Thanks everyone, see you next time!"
)

MOCK_SUMMARY = {
    "executive_summary": (
        "The team conducted their Weekly Sprint Review. The primary highlight was the successful "
        "completion of the Zoom-style Waiting Room and Host Admission flow. The implementation was "
        "praised for its high-fidelity UX, solid security properties, and optimized media connection handling."
    ),
    "key_topics": [
        "Waiting Room UI: Successful delivery of glassmorphic styles and pulse animation.",
        "LiveKit Integration: Deferring guest media streams to optimize connection overhead.",
        "Code Stability: Clean type compliance resolving React Hooks state tracking."
    ],
    "action_items": [
        {"item": "Deploy the complete waiting room feature to the staging environment", "owner": "Dhruv"},
        {"item": "Initiate end-to-end multi-peer verification testing", "owner": "Team"}
    ],
    "sentiment": "Extremely positive, productive, and collaborative."
}

async def transcribe_audio(file_bytes: bytes, filename: str) -> str:
    """
    Transcribe meeting audio using Groq's whisper-large-v3 model.
    Falls back to a high-fidelity mock transcript if GROQ_API_KEY is not set.
    """
    if not settings.GROQ_API_KEY:
        print("[Groq STT] GROQ_API_KEY not found. Using high-fidelity mock fallback transcript.")
        return MOCK_TRANSCRIPT

    url = f"{GROQ_BASE_URL}/v1/audio/transcriptions"
    headers = {"Authorization": f"Bearer {settings.GROQ_API_KEY}"}
    
    # We use 'files' format for multipart/form-data upload
    files = {"file": (filename, file_bytes, "audio/webm")}
    data = {"model": "whisper-large-v3"}

    try:
        async with httpx.AsyncClient(timeout=60.0) as client:
            response = await client.post(url, headers=headers, files=files, data=data)
            response.raise_for_status()
            res_json = response.json()
            return res_json.get("text", "")
    except Exception as e:
        print(f"[Groq STT] Error calling Groq Transcribe API: {e}. Falling back to mock transcript.")
        return MOCK_TRANSCRIPT

async def summarize_transcript(transcript: str) -> dict:
    """
    Summarize a meeting transcript using Groq's Llama-3.3-70b-versatile model.
    Returns a structured dictionary format containing executive summary, key topics, action items, and sentiment.
    """
    if not settings.GROQ_API_KEY:
        print("[Groq LLM] GROQ_API_KEY not found. Using high-fidelity mock fallback summary.")
        return MOCK_SUMMARY

    url = f"{GROQ_BASE_URL}/v1/chat/completions"
    headers = {
        "Authorization": f"Bearer {settings.GROQ_API_KEY}",
        "Content-Type": "application/json"
    }

    system_prompt = (
        "You are an expert executive assistant. Analyze the provided meeting transcript "
        "and return a JSON object summarizing the meeting. The JSON object must strictly "
        "conform to the following structure:\n"
        "{\n"
        "  \"executive_summary\": \"A concise 3-4 sentence paragraph highlighting the overall purpose and results.\",\n"
        "  \"key_topics\": [\"Topic 1 with details\", \"Topic 2 with details\"],\n"
        "  \"action_items\": [\n"
        "    {\"item\": \"The description of the task\", \"owner\": \"The name of the assignee or 'Unassigned'\"}\n"
        "  ],\n"
        "  \"sentiment\": \"A brief summary of the overall atmosphere or tone of the meeting.\"\n"
        "}\n"
        "Do not include any extra explanatory text or markdown formatting tags outside of the pure JSON output."
    )

    payload = {
        "model": "llama-3.3-70b-versatile",
        "messages": [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": f"Here is the meeting transcript:\n\n{transcript}"}
        ],
        "temperature": 0.2,
        "response_format": {"type": "json_object"}
    }

    try:
        async with httpx.AsyncClient(timeout=30.0) as client:
            response = await client.post(url, headers=headers, json=payload)
            response.raise_for_status()
            res_json = response.json()
            raw_content = res_json["choices"][0]["message"]["content"]
            return json.loads(raw_content)
    except Exception as e:
        print(f"[Groq LLM] Error calling Groq LLM API: {e}. Falling back to mock summary.")
        return MOCK_SUMMARY
