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
    clientX: int
    clientY: int
    timestamp: int

class MousePayload(BaseModel):
    UUID: str
    data: List[MouseEvent]

@app.get("/my-name/")
def print_name():
    return {"name":"Ghlen"}

@app.post("/deng")
def collect(user: User):
    return {"name": user.name, "age": user.age}

@app.post("/track-mouse/")
def track_mouse(payload: MousePayload):
    print(payload)
    return "No data received"
