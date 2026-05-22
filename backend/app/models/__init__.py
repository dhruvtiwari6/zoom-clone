import random
import string

def generate_meeting_id() -> str:
    """Generate a Zoom-style 11-digit numeric meeting ID (xxx-xxxx-xxxx)."""
    digits = ''.join(random.choices(string.digits, k=11))
    return f"{digits[:3]}-{digits[3:7]}-{digits[7:11]}"

def generate_passcode() -> str:
    """Generate a 6-character alphanumeric passcode."""
    return ''.join(random.choices(string.ascii_letters + string.digits, k=6))
