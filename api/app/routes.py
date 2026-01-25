from datetime import timedelta
from typing import List

from fastapi import APIRouter, Depends, HTTPException, status, WebSocket, WebSocketDisconnect
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy import or_, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from . import schemas
from .deps import get_current_user, get_db
from .models import Build, Claim, Connection, Inventory, Message, StoreItem, User
from .security import create_access_token, get_password_hash, verify_password

router = APIRouter()

@router.post("/register", response_model=schemas.UserOut)
async def register(payload: schemas.UserCreate, db: AsyncSession = Depends(get_db)):
    user = User(handle=payload.handle, email=payload.email, password_hash=get_password_hash(payload.password))
    db.add(user)
    try:
        await db.commit()
    except IntegrityError:
        await db.rollback()
        raise HTTPException(status_code=400, detail="handle or email already used")
    await db.refresh(user)
    return user


@router.post("/login", response_model=schemas.Token)
async def login(form_data: OAuth2PasswordRequestForm = Depends(), db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(User).where(or_(User.email == form_data.username, User.handle == form_data.username)))
    user = result.scalars().first()
    if not user or not verify_password(form_data.password, user.password_hash):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="invalid credentials")
    token = create_access_token({"sub": str(user.id)}, expires_delta=timedelta(days=7))
    return schemas.Token(access_token=token)


@router.get("/me", response_model=schemas.UserOut)
async def me(current: User = Depends(get_current_user)):
    return current


@router.patch("/me", response_model=schemas.UserOut)
async def update_profile(update: schemas.ProfileUpdate, db: AsyncSession = Depends(get_db), current: User = Depends(get_current_user)):
    if update.bio is not None:
        current.bio = update.bio
    if update.avatar_url is not None:
        current.avatar_url = update.avatar_url
    await db.commit()
    await db.refresh(current)
    return current


@router.post("/connections", response_model=schemas.ConnectionOut)
async def request_connection(payload: schemas.ConnectionCreate, db: AsyncSession = Depends(get_db), current: User = Depends(get_current_user)):
    if str(current.id) == payload.addressee_id:
        raise HTTPException(status_code=400, detail="cannot connect to self")
    conn = Connection(requester_id=current.id, addressee_id=payload.addressee_id)
    db.add(conn)
    try:
        await db.commit()
    except IntegrityError:
        await db.rollback()
        raise HTTPException(status_code=400, detail="already requested")
    await db.refresh(conn)
    return conn


@router.post("/connections/{connection_id}/approve", response_model=schemas.ConnectionOut)
async def approve_connection(connection_id: str, db: AsyncSession = Depends(get_db), current: User = Depends(get_current_user)):
    conn = await db.get(Connection, connection_id)
    if not conn or str(conn.addressee_id) != str(current.id):
        raise HTTPException(status_code=404, detail="not found")
    conn.status = "accepted"
    await db.commit()
    await db.refresh(conn)
    return conn


@router.get("/connections", response_model=List[schemas.ConnectionOut])
async def list_connections(db: AsyncSession = Depends(get_db), current: User = Depends(get_current_user)):
    result = await db.execute(select(Connection).where(or_(Connection.requester_id == current.id, Connection.addressee_id == current.id)))
    return result.scalars().all()


@router.post("/messages", response_model=schemas.MessageOut)
async def send_message(payload: schemas.MessageCreate, db: AsyncSession = Depends(get_db), current: User = Depends(get_current_user)):
    msg = Message(sender_id=current.id, recipient_id=payload.recipient_id, body=payload.body)
    db.add(msg)
    await db.commit()
    await db.refresh(msg)
    return msg


@router.get("/messages", response_model=List[schemas.MessageOut])
async def inbox(db: AsyncSession = Depends(get_db), current: User = Depends(get_current_user)):
    result = await db.execute(select(Message).where(or_(Message.sender_id == current.id, Message.recipient_id == current.id)).order_by(Message.created_at.desc()).limit(50))
    return result.scalars().all()


@router.get("/store", response_model=List[schemas.StoreItemOut])
async def list_store(db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(StoreItem).where(StoreItem.active == True))
    return result.scalars().all()


@router.post("/store/seed")
async def seed_store(db: AsyncSession = Depends(get_db)):
    seeds = [
      StoreItem(sku="prefab-cyber", name="Cyber Spire", kind="prefab", price_cents=0, metadata="{\"color\":\"#5af5ff\"}"),
      StoreItem(sku="prefab-castle", name="Neon Keep", kind="prefab", price_cents=0, metadata="{\"color\":\"#ff4fa7\"}"),
      StoreItem(sku="flag-usa", name="USA Flag", kind="flag", price_cents=0, metadata="{}"),
    ]
    for item in seeds:
        db.merge(item)
    await db.commit()
    return {"ok": True}


@router.websocket("/ws/chat")
async def chat_ws(websocket: WebSocket):
    await websocket.accept()
    try:
        while True:
            data = await websocket.receive_json()
            await websocket.send_json({"echo": data})
    except WebSocketDisconnect:
        return
