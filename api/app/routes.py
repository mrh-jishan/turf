from datetime import datetime, timedelta
from typing import List

from fastapi import APIRouter, Depends, HTTPException, Query, WebSocket, WebSocketDisconnect, status
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy import and_, or_, select, func
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from . import schemas
from .chat_manager import manager
from .deps import get_current_user, get_db
from .models import Build, Claim, Connection, Inventory, Message, StoreItem, User, ChatRoom, ChatMember, SupplyPath, VisibleArea
from .security import create_access_token, get_password_hash, verify_password, decode_token

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


@router.post("/chatrooms", response_model=schemas.ChatRoomOut)
async def create_room(payload: schemas.ChatRoomCreate, db: AsyncSession = Depends(get_db), current: User = Depends(get_current_user)):
    # enforce friendship for each invited member
    for uid in payload.member_ids:
        res = await db.execute(select(Connection).where(and_(Connection.status == "accepted", or_(and_(Connection.requester_id == current.id, Connection.addressee_id == uid), and_(Connection.addressee_id == current.id, Connection.requester_id == uid)))))
        if not res.scalars().first():
            raise HTTPException(status_code=403, detail=f"not connected to {uid}")
    room = ChatRoom(name=payload.name, is_group=payload.is_group)
    db.add(room)
    await db.flush()
    member_ids = set(payload.member_ids + [str(current.id)])
    for uid in member_ids:
        db.add(ChatMember(room_id=room.id, user_id=uid))
    await db.commit()
    await db.refresh(room)
    return room


@router.get("/chatrooms", response_model=List[schemas.ChatRoomOut])
async def my_rooms(db: AsyncSession = Depends(get_db), current: User = Depends(get_current_user)):
    result = await db.execute(select(ChatRoom).join(ChatMember).where(ChatMember.user_id == current.id))
    return result.scalars().all()


@router.post("/messages", response_model=schemas.MessageOut)
async def send_message(payload: schemas.MessageCreate, db: AsyncSession = Depends(get_db), current: User = Depends(get_current_user)):
    member = await db.execute(select(ChatMember).where(and_(ChatMember.room_id == payload.room_id, ChatMember.user_id == current.id)))
    if not member.scalars().first():
        raise HTTPException(status_code=403, detail="not in room")
    msg = Message(
        sender_id=current.id,
        room_id=payload.room_id,
        body=payload.body,
        attachment_url=payload.attachment_url,
        attachment_type=payload.attachment_type,
    )
    db.add(msg)
    await db.commit()
    await db.refresh(msg)
    await manager.broadcast(payload.room_id, {
        "type": "message",
        "room_id": payload.room_id,
        "sender_id": str(current.id),
        "body": msg.body,
        "attachment_url": msg.attachment_url,
        "attachment_type": msg.attachment_type,
        "id": str(msg.id),
        "created_at": msg.created_at.isoformat(),
    })
    return msg


@router.get("/messages", response_model=List[schemas.MessageOut])
async def inbox(room_id: str = Query(...), db: AsyncSession = Depends(get_db), current: User = Depends(get_current_user)):
    member = await db.execute(select(ChatMember).where(and_(ChatMember.room_id == room_id, ChatMember.user_id == current.id)))
    if not member.scalars().first():
        raise HTTPException(status_code=403, detail="not in room")
    result = await db.execute(select(Message).where(Message.room_id == room_id).order_by(Message.created_at.desc()).limit(100))
    return result.scalars().all()


@router.get("/store", response_model=List[schemas.StoreItemOut])
async def list_store(db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(StoreItem).where(StoreItem.active == True))
    return result.scalars().all()


@router.post("/store/seed")
async def seed_store(db: AsyncSession = Depends(get_db)):
    seeds = [
      StoreItem(sku="prefab-cyber", name="Cyber Spire", kind="prefab", price_cents=0, meta="{\"color\":\"#5af5ff\"}"),
      StoreItem(sku="prefab-castle", name="Neon Keep", kind="prefab", price_cents=0, meta="{\"color\":\"#ff4fa7\"}"),
      StoreItem(sku="flag-usa", name="USA Flag", kind="flag", price_cents=0, meta="{}"),
    ]
    for item in seeds:
        db.merge(item)
    await db.commit()
    return {"ok": True}


@router.post("/paths/touch")
async def touch_path(friend_id: str, q: schemas.VisibilityQuery, db: AsyncSession = Depends(get_db), current: User = Depends(get_current_user)):
    # ensure friendship accepted
    conn = await db.execute(select(Connection).where(and_(Connection.status == "accepted", or_(and_(Connection.requester_id == current.id, Connection.addressee_id == friend_id), and_(Connection.addressee_id == current.id, Connection.requester_id == friend_id)))))
    if not conn.scalars().first():
        raise HTTPException(status_code=403, detail="not connected")

    friend_claim = await db.execute(select(Claim).where(Claim.owner_id == friend_id))
    friend = friend_claim.scalars().first()
    my_claim = await db.execute(select(Claim).where(Claim.owner_id == current.id))
    mine = my_claim.scalars().first()
    if not friend or not mine:
        raise HTTPException(status_code=400, detail="both users need home claims")

    # ensure user is physically near friend home (50m)
    pt = func.ST_GeogFromText(f"SRID=4326;POINT({q.lon} {q.lat})")
    near = await db.execute(select(func.ST_DWithin(friend.location, pt, 50)))
    if not near.scalar():
        raise HTTPException(status_code=403, detail="too far from friend")

    line = func.ST_SetSRID(func.ST_MakeLine(mine.location, friend.location), 4326)
    path = await db.execute(select(SupplyPath).where(and_(SupplyPath.user_id == current.id, SupplyPath.friend_id == friend_id)))
    existing = path.scalars().first()
    if existing:
        existing.geom = line
        existing.health = 30
        existing.last_touch = datetime.utcnow()
    else:
        db.add(SupplyPath(user_id=current.id, friend_id=friend_id, geom=line, health=30))
    await db.commit()
    return {"ok": True}


@router.get("/visibility", response_model=schemas.VisibilityOut)
async def visibility(q: schemas.VisibilityQuery = Depends(), db: AsyncSession = Depends(get_db), current: User = Depends(get_current_user)):
    # base point bubble
    pt = func.ST_GeogFromText(f"SRID=4326;POINT({q.lon} {q.lat})")
    base = func.ST_Buffer(pt, q.radius_m)

    # my home
    my_claim = await db.execute(select(Claim.location).where(Claim.owner_id == current.id))
    my_home = my_claim.scalars().first()
    if not my_home:
        raise HTTPException(status_code=400, detail="home not claimed")

    # friends accepted
    friends = await db.execute(select(Claim.location).join(Connection, Claim.owner_id == Connection.addressee_id).where(Connection.requester_id == current.id, Connection.status == "accepted"))
    friend_locs = [row for row in friends.scalars().all()]

    paths = await db.execute(select(SupplyPath.geom).where(and_(SupplyPath.user_id == current.id, SupplyPath.health > 0)))
    path_geoms = [row for row in paths.scalars().all()]

    geometries = [base, func.ST_Buffer(my_home, 1609)]
    geometries.extend(func.ST_Buffer(loc, 1609) for loc in friend_locs)
    geometries.extend(path_geoms)

    union_geom = func.ST_Union(func.ARRAY(geometries))
    result = await db.execute(select(func.ST_AsGeoJSON(union_geom)))
    geojson = result.scalar()

    return schemas.VisibilityOut(visible_geojson=geojson, source_count=len(geometries))


@router.websocket("/ws/chat/{room_id}")
async def chat_ws(websocket: WebSocket, room_id: str, token: str = Query(None), db: AsyncSession = Depends(get_db)):
    if not token:
        await websocket.close(code=4401)
        return
    payload = decode_token(token)
    if not payload or "sub" not in payload:
        await websocket.close(code=4401)
        return
    user_id = payload["sub"]
    member = await db.execute(select(ChatMember).where(and_(ChatMember.room_id == room_id, ChatMember.user_id == user_id)))
    if not member.scalars().first():
        await websocket.close(code=4403)
        return
    await manager.connect(room_id, websocket)
    try:
        while True:
            data = await websocket.receive_json()
            msg = Message(
                sender_id=user_id,
                room_id=room_id,
                body=data.get("body", ""),
                attachment_url=data.get("attachment_url"),
                attachment_type=data.get("attachment_type"),
            )
            db.add(msg)
            await db.commit()
            await db.refresh(msg)
            await manager.broadcast(room_id, {
                "type": "message",
                "room_id": room_id,
                "sender_id": user_id,
                "body": msg.body,
                "attachment_url": msg.attachment_url,
                "attachment_type": msg.attachment_type,
                "id": str(msg.id),
                "created_at": msg.created_at.isoformat(),
            })
    except WebSocketDisconnect:
        manager.disconnect(room_id, websocket)
        return


@router.get("/fog", response_model=schemas.FogOut)
async def fog(
    q: schemas.VisibilityQuery = Depends(),
    min_lon: float | None = Query(None),
    min_lat: float | None = Query(None),
    max_lon: float | None = Query(None),
    max_lat: float | None = Query(None),
    db: AsyncSession = Depends(get_db),
    current: User = Depends(get_current_user),
):
    pt = func.ST_GeogFromText(f"SRID=4326;POINT({q.lon} {q.lat})")
    my_home = (await db.execute(select(Claim.location).where(Claim.owner_id == current.id))).scalars().first()
    if not my_home:
        raise HTTPException(status_code=400, detail="home not claimed")
    friends = await db.execute(
        select(Claim.location)
        .join(Connection, Claim.owner_id == Connection.addressee_id)
        .where(Connection.requester_id == current.id, Connection.status == "accepted")
    )
    friend_locs = friends.scalars().all()
    paths = await db.execute(select(SupplyPath.geom).where(SupplyPath.user_id == current.id, SupplyPath.health > 0))
    path_geoms = paths.scalars().all()

    geoms = [func.ST_Buffer(pt, q.radius_m), func.ST_Buffer(my_home, 1000)]
    geoms += [func.ST_Buffer(loc, 1000) for loc in friend_locs]
    geoms += path_geoms

    visible_union = func.ST_Union(func.ARRAY(geoms))
    world = func.ST_GeogFromText("SRID=4326;POLYGON((-180 -90, -180 90, 180 90, 180 -90, -180 -90))")
    fog_geom = func.ST_Difference(world, visible_union)

    if all(v is not None for v in [min_lon, min_lat, max_lon, max_lat]):
        bbox = func.ST_MakeEnvelope(min_lon, min_lat, max_lon, max_lat, 4326)
        fog_geom = func.ST_Intersection(fog_geom, bbox)

    result = await db.execute(select(func.ST_AsGeoJSON(fog_geom)))
    fog_geojson = result.scalar()
    return schemas.FogOut(fog_geojson=fog_geojson, visible_sources=len(geoms))
