import os
from pathlib import Path
from pydantic import BaseModel
from dotenv import load_dotenv

# Load .env from backend directory or project root
load_dotenv(Path(__file__).parent / ".env")
load_dotenv(Path(__file__).parent.parent / ".env")

class Settings(BaseModel):
    app_name: str = "PARKAR 3D Indoor Spatial Guide API"
    version: str = "0.2.0"
    host: str = "0.0.0.0"
    port: int = 8000
    gemini_api_key: str = os.getenv("GEMINI_API_KEY", "")
    cors_origins: list[str] = [
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "*"
    ]

settings = Settings()
