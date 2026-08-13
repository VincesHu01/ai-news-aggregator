import re
import secrets
import string
from datetime import datetime, timedelta
from typing import List, Optional


def sanitize_text(text: str) -> str:
    if not text:
        return ""
    text = re.sub(r"<[^>]+>", "", text)
    text = re.sub(r"http\S+|www\.\S+", "", text)
    text = re.sub(r"[^\w\s\u4e00-\u9fff]", " ", text)
    text = re.sub(r"\s+", " ", text)
    return text.strip()


def calculate_streak(checkin_dates: List[str]) -> int:
    if not checkin_dates:
        return 0
    sorted_dates = sorted(checkin_dates, reverse=True)
    streak = 1
    today = datetime.utcnow().date()
    yesterday = today - timedelta(days=1)

    for i in range(1, len(sorted_dates)):
        try:
            prev_date = datetime.strptime(sorted_dates[i - 1], "%Y-%m-%d").date()
            curr_date = datetime.strptime(sorted_dates[i], "%Y-%m-%d").date()
            if (prev_date - curr_date).days == 1:
                streak += 1
            else:
                break
        except ValueError:
            break
    return streak


def generate_invite_code(length: int = 12) -> str:
    chars = string.ascii_letters + string.digits
    return "".join(secrets.choice(chars) for _ in range(length)).upper()


def generate_share_token(length: int = 32) -> str:
    return secrets.token_urlsafe(length)


def format_date_string(dt: datetime) -> str:
    return dt.strftime("%Y-%m-%d")


def safe_divide(numerator: float, denominator: float, default: float = 0.0) -> float:
    if denominator == 0:
        return default
    return numerator / denominator


def clamp(value: float, min_val: float = 0.0, max_val: float = 100.0) -> float:
    return max(min_val, min(max_val, value))