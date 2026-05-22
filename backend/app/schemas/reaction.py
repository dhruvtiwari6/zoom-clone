from pydantic import BaseModel

class ReactionCreate(BaseModel):
    emoji: str
    sender_name: str
