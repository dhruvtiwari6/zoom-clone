from datetime import datetime
from pydantic import BaseModel

class MessageCreate(BaseModel):
    sender_name: str
    text: str

class MessageResponse(BaseModel):
    id: int
    meeting_id: int
    sender_name: str
    text: str
    created_at: datetime

    class Config:
        from_attributes = True
