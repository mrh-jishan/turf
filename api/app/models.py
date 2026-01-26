import uuid
from datetime import datetime

from geoalchemy2 import Geography
from sqlalchemy import Boolean, Column, DateTime, ForeignKey, Integer, String, UniqueConstraint, Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship

from .database import Base

class User(Base):
    __tablename__ = "users"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    handle = Column(String(30), unique=True, nullable=False)
    email = Column(String(255), unique=True, nullable=False)
    password_hash = Column(String(255), nullable=False)
    bio = Column(Text, nullable=True)
    avatar_url = Column(String(512), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    verified = Column(Boolean, default=False, nullable=False)

    claims = relationship("Claim", back_populates="owner", cascade="all, delete")

class Claim(Base):
    __tablename__ = "claims"
    __table_args__ = (
        UniqueConstraint("owner_id", name="uq_claim_owner"),
    )

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    owner_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"))
    address_label = Column(String(255), nullable=False)
    location = Column(Geography(geometry_type="POINT", srid=4326), nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    owner = relationship("User", back_populates="claims")
    builds = relationship("Build", back_populates="claim", cascade="all, delete")


class Connection(Base):
    __tablename__ = "connections"
    __table_args__ = (UniqueConstraint("requester_id", "addressee_id", name="uq_connection_pair"),)

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    requester_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"))
    addressee_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"))
    status = Column(String(20), default="pending")  # pending, accepted, blocked
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)


class Message(Base):
    __tablename__ = "messages"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    sender_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"))
    room_id = Column(UUID(as_uuid=True), ForeignKey("chat_rooms.id", ondelete="CASCADE"))
    body = Column(Text, nullable=False)
    attachment_url = Column(Text, nullable=True)
    attachment_type = Column(String(50), nullable=True)  # image, file, voice, etc.
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)


class StoreItem(Base):
    __tablename__ = "store_items"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    sku = Column(String(50), unique=True, nullable=False)
    name = Column(String(100), nullable=False)
    kind = Column(String(30), nullable=False)  # prefab, decal, flag
    price_cents = Column(Integer, nullable=False, default=0)
    meta = Column(Text, nullable=True)
    active = Column(Boolean, default=True, nullable=False)


class Inventory(Base):
    __tablename__ = "inventory"
    __table_args__ = (UniqueConstraint("user_id", "item_id", name="uq_inventory_item"),)

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"))
    item_id = Column(UUID(as_uuid=True), ForeignKey("store_items.id", ondelete="CASCADE"))
    acquired_at = Column(DateTime, default=datetime.utcnow, nullable=False)


class ChatRoom(Base):
    __tablename__ = "chat_rooms"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name = Column(String(80), nullable=False)
    is_group = Column(Boolean, default=False, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)


class ChatMember(Base):
    __tablename__ = "chat_members"
    __table_args__ = (UniqueConstraint("room_id", "user_id", name="uq_member_room_user"),)

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    room_id = Column(UUID(as_uuid=True), ForeignKey("chat_rooms.id", ondelete="CASCADE"))
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"))
    role = Column(String(20), default="member")  # member/admin
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)


class SupplyPath(Base):
    __tablename__ = "supply_paths"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"))
    friend_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"))
    geom = Column(Geography(geometry_type="LINESTRING", srid=4326), nullable=False)
    health = Column(Integer, default=30, nullable=False)  # days remaining
    last_touch = Column(DateTime, default=datetime.utcnow, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    __table_args__ = (UniqueConstraint("user_id", "friend_id", name="uq_supply_path_pair"),)


class VisibleArea(Base):
    __tablename__ = "visible_areas"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"))
    geom = Column(Geography(geometry_type="MULTIPOLYGON", srid=4326), nullable=True)
    refreshed_at = Column(DateTime, default=datetime.utcnow, nullable=False)

class Build(Base):
    __tablename__ = "builds"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    claim_id = Column(UUID(as_uuid=True), ForeignKey("claims.id", ondelete="CASCADE"))
    prefab = Column(String(50), nullable=False)
    decal = Column(String(50), nullable=True)
    flag = Column(String(50), nullable=True)
    height_m = Column(Integer, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    claim = relationship("Claim", back_populates="builds")
