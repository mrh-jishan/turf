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

    class Config:
        orm_mode = True


class Token(BaseModel):
    access_token: str
    token_type: str = "bearer"


class ProfileUpdate(BaseModel):
    bio: Optional[str] = None
    avatar_url: Optional[str] = None


class ClaimCreate(BaseModel):
    owner_id: str
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

    class Config:
        orm_mode = True


class ConnectionCreate(BaseModel):
    addressee_id: str


class ConnectionOut(BaseModel):
    id: str
    requester_id: str
    addressee_id: str
    status: str

    class Config:
        orm_mode = True


class MessageCreate(BaseModel):
    recipient_id: str
    body: str = Field(..., min_length=1, max_length=1000)


class MessageOut(BaseModel):
    id: str
    sender_id: str
    recipient_id: str
    body: str
    created_at: str

    class Config:
        orm_mode = True


class StoreItemOut(BaseModel):
    id: str
    sku: str
    name: str
    kind: str
    price_cents: int
    metadata: Optional[str]
    active: bool

    class Config:
        orm_mode = True


class InventoryOut(BaseModel):
    id: str
    user_id: str
    item_id: str
    acquired_at: str

    class Config:
        orm_mode = True
