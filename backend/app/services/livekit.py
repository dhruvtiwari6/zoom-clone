import os
from livekit import api
from app.config import get_settings

settings = get_settings()

def generate_livekit_token(room_name: str, identity: str, name: str) -> str:
    """Generate a JWT token for joining a LiveKit room robustly."""
    # Ensure LiveKit SDK reads the configured credentials robustly
    os.environ['LIVEKIT_API_KEY'] = settings.LIVEKIT_API_KEY
    os.environ['LIVEKIT_API_SECRET'] = settings.LIVEKIT_API_SECRET

    try:
        token = (
            api.AccessToken()
            .with_identity(identity)
            .with_name(name)
            .with_grants(
                api.VideoGrants(
                    room_join=True,
                    room=room_name,
                )
            )
            .to_jwt()
        )
        return token
    except Exception as e:
        raise RuntimeError(f"LiveKit AccessToken generation failed: {str(e)}")
