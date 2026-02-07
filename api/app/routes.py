from datetime import datetime, timedelta
from typing import List, Optional
from uuid import UUID
import hashlib

from fastapi import APIRouter, Depends, HTTPException, Query, Request, WebSocket, WebSocketDisconnect, status
from fastapi.responses import RedirectResponse
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy import and_, or_, select, func
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from . import schemas
from .chat_manager import manager
from .deps import get_current_user, get_db
from .models import Build, Claim, Connection, Inventory, Message, StoreItem, User, ChatRoom, ChatMember, SupplyPath, VisibleArea, RoomAccess
from .security import create_access_token, get_password_hash, verify_password, decode_token, verify_google_token

router = APIRouter()

@router.post("/auth/google", tags=["Authentication"])
async def google_auth(request: Request, db: AsyncSession = Depends(get_db)):
    """
    Authenticate with Google Sign-In via form submission.
    Redirects to /home on success or /login on error.
    """
    try:
        form_data = await request.form()
        id_token = form_data.get("id_token")
    except:
        return RedirectResponse(url="/login?error=invalid_request", status_code=302)
    
    if not id_token:
        return RedirectResponse(url="/login?error=missing_token", status_code=302)
    
    google_user = await verify_google_token(id_token)
    if not google_user:
        return RedirectResponse(url="/login?error=invalid_token", status_code=302)
    
    # Try to find or create user
    result = await db.execute(select(User).where(User.email == google_user["email"]))
    user = result.scalars().first()
    
    if not user:
        # Create new user from Google
        user = User(
            handle=google_user["email"].split("@")[0],
            email=google_user["email"],
            password_hash=get_password_hash("google_oauth"),  # Placeholder
        )
        db.add(user)
        try:
            await db.commit()
        except IntegrityError:
            await db.rollback()
            # Handle if handle already exists
            base_handle = google_user["email"].split("@")[0]
            for i in range(1, 100):
                user = User(
                    handle=f"{base_handle}{i}",
                    email=google_user["email"],
                    password_hash=get_password_hash("google_oauth"),
                )
                db.add(user)
                try:
                    await db.commit()
                    break
                except IntegrityError:
                    await db.rollback()
    
    token = create_access_token({"sub": str(user.id)}, expires_delta=timedelta(days=7))
    
    response = RedirectResponse(url="/home", status_code=302)
    response.set_cookie(
        key="access_token",
        value=token,
        max_age=604800,  # 7 days
        httponly=True,
        secure=False,
        samesite="lax"
    )
    return response

@router.post("/register", tags=["Authentication"])
async def register(request: Request, db: AsyncSession = Depends(get_db)):
    """
    Register a new user account via form submission.
    Redirects to /login on success or back to /register on error.
    """
    try:
        form_data = await request.form()
        handle = form_data.get("handle")
        email = form_data.get("email")
        password = form_data.get("password")
    except:
        return RedirectResponse(url="/register?error=invalid_request", status_code=302)
    
    if not handle or not email or not password:
        return RedirectResponse(url="/register?error=missing_fields", status_code=302)
    
    if len(password) < 6:
        return RedirectResponse(url="/register?error=password_too_short", status_code=302)
    
    if len(handle) < 3 or len(handle) > 30:
        return RedirectResponse(url="/register?error=invalid_handle_length", status_code=302)
    
    user = User(handle=handle, email=email, password_hash=get_password_hash(password))
    db.add(user)
    try:
        await db.commit()
    except IntegrityError:
        await db.rollback()
        return RedirectResponse(url="/register?error=handle_or_email_taken", status_code=302)
    
    # Redirect to login after successful registration
    return RedirectResponse(url="/login?success=registered", status_code=302)




@router.post("/login", tags=["Authentication"])
async def login(request: Request, form_data: OAuth2PasswordRequestForm = Depends(), db: AsyncSession = Depends(get_db)):
    """
    Authenticate with email/password via form submission.
    Sets HTTP-only cookie and redirects to /home on success.
    """
    result = await db.execute(select(User).where(or_(User.email == form_data.username, User.handle == form_data.username)))
    user = result.scalars().first()
    if not user or not verify_password(form_data.password, user.password_hash):
        return RedirectResponse(url="/login?error=invalid_credentials", status_code=302)
    
    token = create_access_token({"sub": str(user.id)}, expires_delta=timedelta(days=7))
    
    response = RedirectResponse(url="/home", status_code=302)
    response.set_cookie(
        key="access_token",
        value=token,
        max_age=604800,  # 7 days
        httponly=True,
        secure=False,
        samesite="lax"
    )
    return response


@router.post("/api/login", response_model=schemas.TokenResponse, tags=["Authentication"])
async def api_login(login_data: schemas.LoginRequest, db: AsyncSession = Depends(get_db)):
    """
    Authenticate with email/password and get JWT token (JSON API).
    
    Returns a JSON response with access_token for frontend applications.
    Can use email or handle as username.
    """
    result = await db.execute(select(User).where(or_(User.email == login_data.username, User.handle == login_data.username)))
    user = result.scalars().first()
    if not user or not verify_password(login_data.password, user.password_hash):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid credentials")
    
    token = create_access_token({"sub": str(user.id)}, expires_delta=timedelta(days=7))
    return {"access_token": token, "token_type": "bearer"}


@router.post("/api/register", response_model=schemas.UserOut, tags=["Authentication"])
async def api_register(user_data: schemas.UserCreate, db: AsyncSession = Depends(get_db)):
    """
    Register a new user account (JSON API).
    
    Returns the created user object. Frontend should then call /api/login to get a token.
    
    - **handle**: Unique username (3-30 characters)
    - **email**: Valid email address
    - **password**: Minimum 6 characters
    """
    if len(user_data.password) < 6:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Password must be at least 6 characters")
    
    if len(user_data.handle) < 3 or len(user_data.handle) > 30:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Handle must be 3-30 characters")
    
    user = User(handle=user_data.handle, email=user_data.email, password_hash=get_password_hash(user_data.password))
    db.add(user)
    try:
        await db.commit()
        await db.refresh(user)
    except IntegrityError:
        await db.rollback()
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Handle or email already taken")
    
    return user


@router.get("/logout", tags=["Authentication"])
async def logout():
    """
    Logout the current user by clearing the authentication cookie.
    Redirects to /login.
    """
    response = RedirectResponse(url="/login", status_code=302)
    response.delete_cookie(
        key="access_token",
        httponly=True,
        secure=False,
        samesite="lax"
    )
    return response


@router.get("/me", response_model=schemas.UserOut, tags=["Users"])
async def me(current: User = Depends(get_current_user)):
    """
    Get the current authenticated user's profile.
    
    Requires a valid JWT token in the Authorization header.
    Returns the currently logged-in user's information.
    """
    return current


@router.patch("/me", response_model=schemas.UserOut, tags=["Users"])
async def update_profile(update: schemas.ProfileUpdate, db: AsyncSession = Depends(get_db), current: User = Depends(get_current_user)):
    """
    Update the current user's profile.
    
    Update bio and/or avatar URL. Only provided fields are updated.
    
    - **bio**: User biography (optional)
    - **avatar_url**: URL to avatar image (optional)
    """
    if update.bio is not None:
        current.bio = update.bio
    if update.avatar_url is not None:
        current.avatar_url = update.avatar_url
    await db.commit()
    await db.refresh(current)
    return current


@router.get("/users/{user_id}", response_model=schemas.UserOut, tags=["Users"])
async def get_user_profile(user_id: str, db: AsyncSession = Depends(get_db)):
    """
    Get a user's public profile by ID.
    
    Returns user information including handle, bio, avatar, and verification status.
    Public endpoint - no authentication required.
    
    - **user_id**: UUID of the user
    """
    try:
        uid = UUID(user_id)
    except:
        raise HTTPException(status_code=400, detail="invalid user_id format")
    
    user = await db.get(User, uid)
    if not user:
        raise HTTPException(status_code=404, detail="user not found")
    
    return user


@router.post("/users/{user_id}/verify", response_model=schemas.UserOut, tags=["Users"])
async def verify_user(user_id: str, db: AsyncSession = Depends(get_db), current: User = Depends(get_current_user)):
    """
    Mark a user as verified (user can only verify themselves).
    
    In production, this would be triggered by Stripe/Persona webhook.
    For development, users can mark themselves as verified.
    
    - **user_id**: UUID of the user to verify
    """
    try:
        uid = UUID(user_id)
    except:
        raise HTTPException(status_code=400, detail="invalid user_id format")
    
    # Only allow users to verify themselves
    if str(current.id) != user_id:
        raise HTTPException(status_code=403, detail="can only verify yourself")
    
    current.verified = True
    await db.commit()
    await db.refresh(current)
    return current


@router.post("/connections", response_model=schemas.ConnectionOut, tags=["Connections"])
async def request_connection(payload: schemas.ConnectionCreate, db: AsyncSession = Depends(get_db), current: User = Depends(get_current_user)):
    """
    Request a connection with another user.
    
    Initiates a friend request to another user.
    The addressee must approve the connection before it becomes active.
    
    - **addressee_id**: ID of the user to connect with
    """
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


@router.post("/connections/{connection_id}/approve", response_model=schemas.ConnectionOut, tags=["Connections"])
async def approve_connection(connection_id: str, db: AsyncSession = Depends(get_db), current: User = Depends(get_current_user)):
    """
    Approve a pending connection request.
    
    Accept a friend request from another user.
    Only the addressee of the request can approve it.
    
    - **connection_id**: ID of the connection to approve
    """
    conn = await db.get(Connection, connection_id)
    if not conn or str(conn.addressee_id) != str(current.id):
        raise HTTPException(status_code=404, detail="not found")
    conn.status = "accepted"
    await db.commit()
    await db.refresh(conn)
    return conn


@router.get("/connections", response_model=List[schemas.ConnectionOut], tags=["Connections"])
async def list_connections(db: AsyncSession = Depends(get_db), current: User = Depends(get_current_user)):
    """
    List all connections for the current user.
    
    Returns both sent and received connection requests.
    Includes pending and accepted connections.
    """
    result = await db.execute(select(Connection).where(or_(Connection.requester_id == current.id, Connection.addressee_id == current.id)))
    return result.scalars().all()


@router.post("/chatrooms", response_model=schemas.ChatRoomOut, tags=["Chat"])
async def create_room(payload: schemas.ChatRoomCreate, db: AsyncSession = Depends(get_db), current: User = Depends(get_current_user)):
    """
    Create a new chat room.
    
    Creates a group or direct message chat room.
    All invited members must have accepted connections with the creator.
    The creator is automatically added as a member.
    
    - **name**: Room name
    - **member_ids**: List of user IDs to invite
    - **is_group**: Whether this is a group chat (true) or direct message (false)
    """
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


@router.get("/chatrooms", response_model=List[schemas.ChatRoomOut], tags=["Chat"])
async def my_rooms(db: AsyncSession = Depends(get_db), current: User = Depends(get_current_user)):
    """
    Get all chat rooms the current user is a member of.
    
    Returns list of all group chats and direct messages for the current user.
    """
    result = await db.execute(select(ChatRoom).join(ChatMember).where(ChatMember.user_id == current.id))
    return result.scalars().all()


@router.get("/chatrooms/top", response_model=List[schemas.TopRoom], tags=["Chat"])
async def top_rooms(limit: int = 10):
    """
    Get top chat rooms by current online user count.
    
    Returns list of up to `limit` (default 10) most active rooms by online user count.
    """
    top = manager.get_top_rooms(limit)
    return [schemas.TopRoom(room_id=room_id, online_count=count) for room_id, count in top]


@router.post("/chatrooms/access", tags=["Chat"])
async def track_room_access(room_id: str = Query(...), db: AsyncSession = Depends(get_db), current: User = Depends(get_current_user)):
    """
    Track user's room access for room history.
    
    Records when a user accesses a chat room to build their previous rooms list.
    """
    if not room_id or room_id == "demo-room":
        return {"status": "ok"}
    
    # Try to find existing access record
    result = await db.execute(
        select(RoomAccess).where(
            and_(RoomAccess.user_id == current.id, RoomAccess.room_id == room_id)
        )
    )
    access = result.scalars().first()
    
    if access:
        # Update last_accessed time
        access.last_accessed = datetime.utcnow()
    else:
        # Create new access record
        access = RoomAccess(user_id=current.id, room_id=room_id)
        db.add(access)
    
    await db.commit()
    return {"status": "ok"}


@router.get("/chatrooms/previous", response_model=List[schemas.RoomAccessOut], tags=["Chat"])
async def get_previous_rooms(db: AsyncSession = Depends(get_db), current: User = Depends(get_current_user)):
    """
    Get user's previously accessed chat rooms.
    
    Returns list of up to 20 most recently accessed rooms, ordered by last access time.
    """
    result = await db.execute(
        select(RoomAccess)
        .where(RoomAccess.user_id == current.id)
        .order_by(RoomAccess.last_accessed.desc())
        .limit(20)
    )
    rooms = result.scalars().all()
    return [
        {
            "room_id": room.room_id,
            "last_accessed": room.last_accessed,
        }
        for room in rooms
    ]



@router.post("/messages", response_model=schemas.MessageOut, tags=["Chat"])
async def send_message(payload: schemas.MessageCreate, db: AsyncSession = Depends(get_db), current: User = Depends(get_current_user)):
    """
    Send a message to a chat room.
    
    Posts a message to a chat room. User must be a member of the room.
    Message is broadcast to all connected WebSocket clients in the room.
    
    - **room_id**: ID of the chat room
    - **body**: Message text (1-2000 characters)
    - **attachment_url**: Optional URL to attached media
    - **attachment_type**: Optional type of attachment (image, video, etc.)
    """
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


@router.get("/messages", response_model=List[schemas.MessageOut], tags=["Chat"])
async def inbox(room_id: str = Query(...), offset: int = Query(0), limit: int = Query(50), db: AsyncSession = Depends(get_db), current: User = Depends(get_current_user)):
    """
    Get message history for a chat room with pagination.
    
    Retrieves messages from a chat room ordered chronologically with pagination support.
    User must be a member of the room to access messages.
    
    - **room_id**: ID of the chat room (can be string or UUID)
    - **offset**: Number of messages to skip (for pagination)
    - **limit**: Number of messages to return (default 50, max 100)
    """
    # Clamp limit to max 100
    limit = min(limit, 100)
    
    # Convert string room_id to UUID using MD5 hash like WebSocket does
    try:
        room_uuid = UUID(room_id)
    except:
        # If not a valid UUID, convert string to UUID using MD5 hash
        room_uuid = UUID(hashlib.md5(room_id.encode()).hexdigest())
    
    # Verify user is a member of the room
    member = await db.execute(select(ChatMember).where(and_(ChatMember.room_id == room_uuid, ChatMember.user_id == current.id)))
    if not member.scalars().first():
        raise HTTPException(status_code=403, detail="not in room")
    
    # Get messages with sender info (ordered by descending to get newest first, then reverse)
    result = await db.execute(
        select(Message, User.handle)
        .join(User, Message.sender_id == User.id)
        .where(Message.room_id == room_uuid)
        .order_by(Message.created_at.desc())
        .offset(offset)
        .limit(limit)
    )
    rows = result.all()
    
    messages = []
    for message, sender_handle in rows:
        msg_dict = {
            'id': str(message.id),
            'sender_id': str(message.sender_id),
            'sender_handle': sender_handle,
            'room_id': str(message.room_id),
            'body': message.body,
            'attachment_url': message.attachment_url,
            'attachment_type': message.attachment_type,
            'created_at': message.created_at.isoformat(),
        }
        messages.append(schemas.MessageOut(**msg_dict))
    
    # Reverse to get chronological order (oldest to newest)
    return list(reversed(messages))


@router.get("/store", response_model=List[schemas.StoreItemOut], tags=["Store"])
async def list_store(db: AsyncSession = Depends(get_db)):
    """
    List all available store items.
    
    Returns catalog of purchasable prefabs, decorations, and other items.
    Public endpoint - no authentication required.
    """
    result = await db.execute(select(StoreItem).where(StoreItem.active == True))
    return result.scalars().all()


@router.post("/store/seed", tags=["Store"])
async def seed_store(db: AsyncSession = Depends(get_db)):
    """
    Initialize store with sample items.
    
    Populates the store with default prefabs and decorations.
    Usually called once during setup. Idempotent - can be called multiple times.
    """
    seeds = [
      StoreItem(sku="prefab-cyber", name="Cyber Spire", kind="prefab", price_cents=0, meta="{\"color\":\"#5af5ff\"}"),
      StoreItem(sku="prefab-castle", name="Neon Keep", kind="prefab", price_cents=0, meta="{\"color\":\"#ff4fa7\"}"),
      StoreItem(sku="flag-usa", name="USA Flag", kind="flag", price_cents=0, meta="{}"),
    ]
    for item in seeds:
        db.merge(item)
    await db.commit()
    return {"ok": True}


@router.post("/paths/touch", tags=["Map"])
async def touch_path(friend_id: str, q: schemas.VisibilityQuery, db: AsyncSession = Depends(get_db), current: User = Depends(get_current_user)):
    """
    Create or refresh a supply path to a friend's location.
    
    Establishes a connection line between your home and a friend's home.
    User must be physically near the friend's home (within 50m).
    
    - **friend_id**: ID of the friend
    - **q**: Visibility query with current location
    
    Requires accepted connection with the friend.
    Both users must have claimed home locations.
    """
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


@router.get("/visibility", response_model=schemas.VisibilityOut, tags=["Map"])
async def visibility(q: schemas.VisibilityQuery = Depends(), db: AsyncSession = Depends(get_db), current: User = Depends(get_current_user)):
    """
    Get visible area based on FOG algorithm.
    
    Calculates what areas the user can see based on:
    - Current location (base radius)
    - User's home claim
    - Accepted connections' home locations
    - Active supply paths to friends
    
    Query parameters:
    - **lat**: Current latitude
    - **lon**: Current longitude
    - **radius_m**: Detection radius in meters (default 50, max 200)
    
    Returns GeoJSON polygon of visible territory.
    """
    import json
    
    # Create a simple circle GeoJSON around the current location for development
    # In production, this would use the full FOG algorithm
    radius_km = q.radius_m / 1000.0
    
    # Create a simple point feature
    feature = {
        "type": "Feature",
        "geometry": {
            "type": "Point",
            "coordinates": [q.lon, q.lat]
        },
        "properties": {}
    }
    
    # For visibility, return a simple buffer circle as GeoJSON
    try:
        pt = func.ST_GeogFromText(f"SRID=4326;POINT({q.lon} {q.lat})")
        buffer_geom = func.ST_Buffer(pt, q.radius_m)
        result = await db.execute(select(func.ST_AsGeoJSON(buffer_geom)))
        geojson = result.scalar()
        if geojson:
            return schemas.VisibilityOut(visible_geojson=geojson, source_count=1)
    except Exception as e:
        pass
    
    # Fallback to simple point
    return schemas.VisibilityOut(visible_geojson=json.dumps(feature["geometry"]), source_count=1)


@router.websocket("/ws/chat/{room_id}", name="chat_websocket")
async def chat_ws(websocket: WebSocket, room_id: str, token: str = Query(None), db: AsyncSession = Depends(get_db)):
    """
    WebSocket endpoint for real-time chat.
    
    Establishes a WebSocket connection for bidirectional chat communication.
    
    Connection parameters:
    - **room_id**: Chat room ID (path parameter) - can be a UUID or string
    - **token**: JWT authentication token (query parameter)
    
    Message format (JSON):
    {
        "body": "message text",
        "attachment_url": "optional URL",
        "attachment_type": "optional type"
    }
    
    Broadcast events:
    {
        "type": "message",
        "room_id": "...",
        "sender_id": "...",
        "body": "...",
        "id": "...",
        "created_at": "ISO timestamp"
    }
    """
    if not token:
        await websocket.close(code=4401)
        return
    payload = decode_token(token)
    if not payload or "sub" not in payload:
        await websocket.close(code=4401)
        return
    user_id = payload["sub"]
    
    # Try to parse as UUID, if not valid create one from string
    try:
        room_uuid = UUID(room_id)
    except ValueError:
        # Generate UUID from string for non-UUID room IDs (for demo purposes)
        room_uuid = UUID(hashlib.md5(room_id.encode()).hexdigest())
    
    room = await db.execute(select(ChatRoom).where(ChatRoom.id == room_uuid))
    room = room.scalars().first()
    
    if not room:
        # Auto-create room for development
        room = ChatRoom(id=room_uuid, name=f"Room: {room_id}", is_group=True)
        db.add(room)
        await db.flush()
    
    # Ensure user is a member, if not add them (for development)
    member = await db.execute(select(ChatMember).where(and_(ChatMember.room_id == room_uuid, ChatMember.user_id == user_id)))
    if not member.scalars().first():
        # Auto-add user to room for development
        db.add(ChatMember(room_id=room_uuid, user_id=user_id))
    
    await db.commit()
    await manager.connect(room_id, websocket)
    try:
        while True:
            data = await websocket.receive_json()
            msg = Message(
                sender_id=user_id,
                room_id=room_uuid,
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


@router.get("/fog", response_model=schemas.FogOut, tags=["Map"])
async def fog(
    q: schemas.VisibilityQuery = Depends(),
    min_lon: float | None = Query(None),
    min_lat: float | None = Query(None),
    max_lon: float | None = Query(None),
    max_lat: float | None = Query(None),
    db: AsyncSession = Depends(get_db),
    current: User = Depends(get_current_user),
):
    """
    Get FOG (unexplored territory) based on visibility.
    
    Returns GeoJSON polygon of areas NOT visible to the user.
    The inverse of the visibility endpoint.
    
    Query parameters:
    - **lat**: Current latitude
    - **lon**: Current longitude
    - **radius_m**: Detection radius in meters (optional)
    - **min_lon, min_lat, max_lon, max_lat**: Optional bounding box to limit area
    
    Returns GeoJSON polygon representing unexplored fog areas within bbox.
    """
    import json
    
    # For development, return a simple "world minus circle" as an approximation of fog
    # Create a simple polygon representing unexplored areas
    
    try:
        # Try to calculate the actual fog geometry
        pt = func.ST_GeogFromText(f"SRID=4326;POINT({q.lon} {q.lat})")
        visible_buffer = func.ST_Buffer(pt, q.radius_m)
        
        # Create world polygon
        world = func.ST_GeogFromText("SRID=4326;POLYGON((-180 -90, -180 90, 180 90, 180 -90, -180 -90))")
        
        # Calculate fog as world minus visible
        fog_geom = func.ST_Difference(world, visible_buffer)
        result = await db.execute(select(func.ST_AsGeoJSON(fog_geom)))
        fog_geojson = result.scalar()
        
        if fog_geojson:
            return schemas.FogOut(fog_geojson=fog_geojson, visible_sources=1)
    except Exception as e:
        pass
    
    # Fallback: return empty FeatureCollection (no fog to render)
    empty_fc = {
        "type": "FeatureCollection",
        "features": []
    }
    return schemas.FogOut(fog_geojson=json.dumps(empty_fc), visible_sources=0)

    if all(v is not None for v in [min_lon, min_lat, max_lon, max_lat]):
        bbox = func.ST_MakeEnvelope(min_lon, min_lat, max_lon, max_lat, 4326)
        fog_geom = func.ST_Intersection(fog_geom, bbox)

    result = await db.execute(select(func.ST_AsGeoJSON(fog_geom)))
    fog_geojson = result.scalar()
    return schemas.FogOut(fog_geojson=fog_geojson, visible_sources=len(geoms))
