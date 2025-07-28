from pydantic import BaseModel
from typing import Literal, List

class WindowSize(BaseModel):
    width: int
    height: int

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

class ScrollEvent(BaseModel):
    t: float
    dy: float

class FocusChange(BaseModel):
    type: Literal["focus", "blur"]
    t: float

# Aggregated payload model
# The `profile_id` has been REMOVED from this model.
# It will be passed exclusively as a URL path parameter.
class Payload(BaseModel):
    startTimestamp: float
    endTimestamp: float
    windowSize: WindowSize
    keyEvents: List[KeyEvent]
    mousePaths: List[List[MousePoint]]
    clicks: List[Click]
    scrollEvents: List[ScrollEvent]
    focusChanges: List[FocusChange]