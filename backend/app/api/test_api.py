from fastapi import FastAPI
from pydantic import BaseModel
from typing import Optional, List
from fastapi.middleware.cors import CORSMiddleware

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # allow all origins
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

class MouseEvent(BaseModel):
    x: int
    y: int
    timestamp: int

class MousePayload(BaseModel):
    UUID: str
    data: List[MouseEvent]

@app.post("/track-mouse/")
def track_mouse(payload: MousePayload):
    print(payload.UUID)
    print(payload)
    return "No data received"
