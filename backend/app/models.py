from pydantic import BaseModel
from typing import Literal, List

class KeyEvent(BaseModel):
    code: str
    downTime: float
    upTime: float

class MousePoint(BaseModel):
    t: float
    x: int
    y: int

class Click(BaseModel):
    t: float
    x: int
    y: int
    button: int
    duration: float

# Aggregated payload model
class Payload(BaseModel):
    startTimestamp: float
    endTimestamp: float
    keyEvents: List[KeyEvent]
    mousePaths: List[List[MousePoint]]
    clicks: List[Click]
