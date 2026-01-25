import asyncio
from typing import List

from fastapi import Depends, FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.sql import func

from .config import settings
from .database import Base, engine, get_session
from .models import Build, Claim, User
from .schemas import BuildCreate, BuildOut, ClaimCreate, ClaimOut, NearbyQuery, UserCreate, UserOut

app = FastAPI(title=settings.app_name, version="0.1.0", openapi_url="/openapi.json")

app.add_middleware(
    CORSMiddleware,
    allow_origins=[settings.allowed_origin] if settings.allowed_origin != "*" else ["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("startup")
async def startup_event():
    # Ensure tables exist in local/dev. In prod use migrations.
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)


@app.get("/health")
async def health():
    return {"status": "ok"}


@app.post("/users", response_model=UserOut)
async def create_user(payload: UserCreate, session: AsyncSession = Depends(get_session)):
    user = User(handle=payload.handle)
    session.add(user)
    try:
        await session.commit()
    except IntegrityError:
        await session.rollback()
        raise HTTPException(status_code=400, detail="handle already taken")
    await session.refresh(user)
    return user


@app.post("/claims", response_model=ClaimOut)
async def create_claim(payload: ClaimCreate, session: AsyncSession = Depends(get_session)):
    # enforce single claim per coordinate (approx 20m grid by rounding 5th decimal ~1.1m)
    pt_wkt = f"SRID=4326;POINT({payload.lon} {payload.lat})"
    existing = await session.execute(
        select(Claim).where(func.ST_DWithin(Claim.location, func.ST_GeogFromText(pt_wkt), 20))
    )
    if existing.scalars().first():
        raise HTTPException(status_code=409, detail="location already claimed")

    claim = Claim(
        owner_id=payload.owner_id,
        address_label=payload.address_label,
        location=pt_wkt,
    )
    session.add(claim)
    try:
        await session.commit()
    except IntegrityError:
        await session.rollback()
        raise HTTPException(status_code=400, detail="owner already has a claim or invalid owner")
    await session.refresh(claim)
    lon, lat = payload.lon, payload.lat
    return ClaimOut(
        id=str(claim.id),
        owner_id=str(claim.owner_id),
        address_label=claim.address_label,
        lat=lat,
        lon=lon,
    )


@app.get("/nearby", response_model=List[ClaimOut])
async def nearby(q: NearbyQuery = Depends(), session: AsyncSession = Depends(get_session)):
    pt_wkt = f"SRID=4326;POINT({q.lon} {q.lat})"
    result = await session.execute(
        select(Claim, func.ST_X(func.ST_AsText(Claim.location)), func.ST_Y(func.ST_AsText(Claim.location)))
        .where(func.ST_DWithin(Claim.location, func.ST_GeogFromText(pt_wkt), q.radius_m))
        .limit(200)
    )
    rows = result.all()
    claims = []
    for claim, lon, lat in rows:
        claims.append(
            ClaimOut(
                id=str(claim.id),
                owner_id=str(claim.owner_id),
                address_label=claim.address_label,
                lat=float(lat),
                lon=float(lon),
            )
        )
    return claims


@app.post("/builds", response_model=BuildOut)
async def create_build(payload: BuildCreate, session: AsyncSession = Depends(get_session)):
    # simple existence + per-claim single build for now
    claim = await session.get(Claim, payload.claim_id)
    if not claim:
        raise HTTPException(status_code=404, detail="claim not found")
    existing = await session.execute(select(Build).where(Build.claim_id == payload.claim_id))
    if existing.scalars().first():
        raise HTTPException(status_code=409, detail="build already exists")

    build = Build(
        claim_id=payload.claim_id,
        prefab=payload.prefab,
        decal=payload.decal,
        flag=payload.flag,
        height_m=payload.height_m,
    )
    session.add(build)
    await session.commit()
    await session.refresh(build)
    return build
