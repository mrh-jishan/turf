from typing import Optional, List
from pydantic import BaseModel, Field, validator


class UserCreate(BaseModel):
    handle: str = Field(..., min_length=3, max_length=30)
    email: str
    password: str = Field(..., min_length=6)


class UserOut(BaseModel):
    id: str
    handle: str
    email: str
    verified: bool
    bio: Optional[str] = None
    avatar_url: Optional[str] = None

    @validator('id', pre=True)
    def convert_uuid_to_str(cls, v):
        if hasattr(v, 'hex'):  # UUID object
            return str(v)
        return v

    class Config:
        orm_mode = True


class Token(BaseModel):
    access_token: str
    token_type: str = "bearer"


class LoginRequest(BaseModel):
    username: str = Field(..., description="Email or handle")
    password: str = Field(..., min_length=1)


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"


class ProfileUpdate(BaseModel):
    bio: Optional[str] = None
    avatar_url: Optional[str] = None


class ClaimCreate(BaseModel):
    lat: float
    lon: float
    address_label: str

    @validator("lat")
    def lat_range(cls, v):
        if not -90 <= v <= 90:
            raise ValueError("lat must be between -90 and 90")
        return v

    @validator("lon")
    def lon_range(cls, v):
        if not -180 <= v <= 180:
            raise ValueError("lon must be between -180 and 180")
        return v


class ClaimOut(BaseModel):
    id: str
    owner_id: str
    address_label: str
    lat: float
    lon: float

    @validator('id', 'owner_id', pre=True)
    def convert_uuid_to_str(cls, v):
        if hasattr(v, 'hex'):  # UUID object
            return str(v)
        return v

    class Config:
        orm_mode = True


class NearbyQuery(BaseModel):
    lat: float
    lon: float
    radius_m: int = Field(2000, ge=100, le=50000)


class BuildCreate(BaseModel):
    claim_id: str
    prefab: str
    decal: Optional[str] = None
    flag: Optional[str] = None
    height_m: int = Field(..., ge=1, le=200)


class BuildOut(BaseModel):
    id: str
    prefab: str
    decal: Optional[str]
    flag: Optional[str]
    height_m: int

    @validator('id', pre=True)
    def convert_uuid_to_str(cls, v):
        if hasattr(v, 'hex'):  # UUID object
            return str(v)
        return v

    class Config:
        orm_mode = True


class ConnectionCreate(BaseModel):
    addressee_id: str


class ConnectionOut(BaseModel):
    id: str
    requester_id: str
    addressee_id: str
    status: str

    @validator('id', 'requester_id', 'addressee_id', pre=True)
    def convert_uuid_to_str(cls, v):
        if hasattr(v, 'hex'):  # UUID object
            return str(v)
        return v

    class Config:
        orm_mode = True


class MessageCreate(BaseModel):
    room_id: str
    body: str = Field(..., min_length=1, max_length=2000)
    attachment_url: Optional[str] = None
    attachment_type: Optional[str] = None


class MessageOut(BaseModel):
    id: str
    sender_id: str
    sender_handle: Optional[str] = None
    room_id: str
    body: str
    attachment_url: Optional[str]
    attachment_type: Optional[str]
    created_at: str

    @validator('id', 'sender_id', 'room_id', pre=True)
    def convert_uuid_to_str(cls, v):
        if hasattr(v, 'hex'):  # UUID object
            return str(v)
        return v

    class Config:
        orm_mode = True


class StoreItemOut(BaseModel):
    id: str
    sku: str
    name: str
    kind: str
    price_cents: int
    meta: Optional[str]
    active: bool

    @validator('id', pre=True)
    def convert_uuid_to_str(cls, v):
        if hasattr(v, 'hex'):  # UUID object
            return str(v)
        return v

    class Config:
        orm_mode = True


class InventoryOut(BaseModel):
    id: str
    user_id: str
    item_id: str
    acquired_at: str

    @validator('id', 'user_id', 'item_id', pre=True)
    def convert_uuid_to_str(cls, v):
        if hasattr(v, 'hex'):  # UUID object
            return str(v)
        return v

    class Config:
        orm_mode = True


class ChatRoomCreate(BaseModel):
    name: str
    member_ids: List[str]
    is_group: bool = True


class ChatRoomOut(BaseModel):
    id: str
    name: str
    is_group: bool

    @validator('id', pre=True)
    def convert_uuid_to_str(cls, v):
        if hasattr(v, 'hex'):  # UUID object
            return str(v)
        return v

    class Config:
        orm_mode = True


class VisibilityQuery(BaseModel):
    lat: float
    lon: float
    radius_m: int = Field(50, ge=20, le=200)


class VisibilityOut(BaseModel):
    visible_geojson: str
    source_count: int


class FogOut(BaseModel):
    fog_geojson: str
    visible_sources: int


class TopRoom(BaseModel):
    room_id: str
    online_count: int
