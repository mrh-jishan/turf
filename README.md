# Turf — Prove You're There, Build Your Territory

**The Social App Where Location Matters.** Claim your real-world territory, prove it with photos, build monuments, connect with friends, and unlock the map around you. Like BeReal + Pokémon GO + Discord, but for the actual world.

> Verified home base • Fog-of-war visibility • Daily check-ins • Leaderboards • 3D voxel buildings • Friend supply lines • Real-world incentives

![Turf App Demo](doc/demo.png)

---

## 🎮 The Pitch

You verify where you live. Your home glows on the map within a 1-mile radius to friends. Build a voxel monument above your territory. To see other neighborhoods light up, you have to actually visit your friends IRL and maintain those "supply lines." The map reveals itself as you explore.

**Why it's addictive:**
- 📍 **Daily Habit:** Check in to prove you're there, break the habit and your glow fades
- 🏗️ **Competition:** Beat your neighbor's tower height on the leaderboard
- 👯 **FOMO:** See which friends are active in your area right now
- 🎁 **Cosmetics:** Unlock seasonal skins, badges, and XP by being active
- 📸 **Shareable:** Post photo proof to social media with your territory location

---

## ✨ Core Features (Beta)

### Current (v0)
- ✅ **User Authentication** - Email/password + Google OAuth
- ✅ **Location Claims** - Claim a 20m territory with address label
- ✅ **3D Builds** - Place voxel monuments (prefab, decal, flag, height)
- ✅ **Fog of War** - Map visibility based on verified home + friend connections
- ✅ **WebSocket Chat** - Real-time messaging in group/DM rooms
- ✅ **Friend Connections** - Request, approve, list friends
- ✅ **Supply Paths** - Friendship health system (decays if not visited)

### Coming Soon (Beta Features)
- 🔄 **Daily Check-in** - Location ping with proof (optional photo)
- 📊 **Leaderboards** - Top territories by ZIP code, state, country
- 📸 **Photo Verification** - Claim with timestamp/location metadata
- 👁️ **Activity Feed** - See what friends are building/visiting
- 🎯 **XP/Leveling** - Earn points, unlock cosmetics and badges
- 🌍 **"Who's Around?"** - Real-time friend presence on map
- 🎨 **Seasonal Cosmetics** - Limited-time building skins & avatars
- 🔔 **Smart Notifications** - Friend activity, presence alerts, challenges
- 🏪 **Local Deals** - Partner with local businesses for territory perks

---

## 🚀 Full Feature Roadmap

### Phase 1: Daily Engagement Loop (Weeks 1-2)
- [ ] Daily location check-in endpoint + mobile UI
- [ ] Presence indicator on profile ("Was here 3 hours ago")
- [ ] Check-in streak counter (loses count after 1 day missed)
- [ ] Photo upload for claims (with EXIF location validation)
- [ ] "I was here" moments sharing to feed

### Phase 2: Gamification & Competition (Weeks 2-3)
- [ ] Leaderboard by ZIP code:
  - [ ] Tallest building
  - [ ] Most visited territory
  - [ ] Most friends living nearby
- [ ] Global leaderboard (state, country-level)
- [ ] XP system:
  - [ ] +10 XP for claiming territory
  - [ ] +50 XP for visiting friend's territory
  - [ ] +30 XP for photo proof
  - [ ] +100 XP for first claim in ZIP
- [ ] Leveling tiers: Bronze → Silver → Gold → Platinum
- [ ] Badge system (Verified Resident, Tower Architect, Map Explorer, etc.)

### Phase 3: Social Discovery (Weeks 3-4)
- [ ] Friend activity feed/timeline
- [ ] "Hot spots" map layer (active areas, high building density)
- [ ] Mutual territory finder ("Both you and Sarah claimed Austin")
- [ ] Nearby users discovery ("3 players active in your ZIP right now")
- [ ] Territory suggestions ("Your friends are in Boston, claim there")
- [ ] Local events integration (meetups, tournaments)

### Phase 4: Cosmetics & Status (Weeks 4-5)
- [ ] Seasonal cosmetic pass (monthly themed skins)
- [ ] Avatar customization (colors, patterns, emotes)
- [ ] Limited-time building skins (Neon Glow, Winter Peak, Cyberpunk)
- [ ] Territory customization (banners, titles, descriptions)
- [ ] Rare cosmetics (founder badges, limited-edition prefabs)
- [ ] Cosmetics marketplace (earn/trade cosmetics)

### Phase 5: Real-World Integration (Weeks 5-6)
- [ ] Local business partnerships
  - [ ] Coffee shop: 10% off if verified in nearby territory
  - [ ] Restaurant: Discount for groups meeting at shared territories
- [ ] First claimant bonus (permanent founder badge)
- [ ] Real-world events on map (local tournaments, meetups)
- [ ] Reward conversion (XP → coupons, store items)

### Phase 6: Viral Mechanics (Weeks 6-7)
- [ ] Shareable territory cards (Instagram Story-ready images)
- [ ] Invite system:
  - [ ] "Invite 3 friends, unlock rare cosmetic"
  - [ ] Invitee joins? Both get bonus XP
- [ ] TikTok/Reels integration (territory watermark)
- [ ] "Territory takeover" challenges (shortest time to max out leaderboard)
- [ ] Group claiming (share territory, split cosmetic rewards)

### Phase 7: Advanced Social (Weeks 7-8)
- [ ] Territory lore/history ("First claimed Nov 2024 by @username")
- [ ] Territory stats page (visitors, friends nearby, building height over time)
- [ ] Status messages ("I'm at my territory now")
- [ ] Seasonal events (Urban Mythology Week - claim landmarks)
- [ ] Territory milestones (500+ visitors, 10+ friends live here)

### Phase 8: Safety & Scale (Ongoing)
- [ ] Content moderation (report claims, messages, users)
- [ ] User blocking / muting
- [ ] Admin dashboard (review reports, ban users)
- [ ] Rate limiting (anti-spam, anti-abuse)
- [ ] Email verification flow
- [ ] Password reset
- [ ] 2FA for verified users
- [ ] Input sanitization (XSS prevention)

### Phase 9: Infrastructure & Monitoring (Ongoing)
- [ ] Structured logging (JSON logs for all API calls)
- [ ] Error tracking (Sentry integration)
- [ ] Database migrations (Alembic)
- [ ] Performance monitoring (API latency, DB query times)
- [ ] Health checks & uptime monitoring
- [ ] CDN for static assets
- [ ] HTTPS enforcement
- [ ] Database connection pooling

---

## 🛠️ Project Structure

This repo contains:
- **`api/`**: FastAPI + PostGIS backend (auth, claims, builds, chat, scoring)
- **`web/`**: Next.js PWA with Mapbox (responsive, mobile-first)
- **`infra/`**: Docker Compose for local development (PostgreSQL + PostGIS)

---

## 🚀 Getting Started

### Local Development (Docker)
```bash
cd infra
cp ../api/.env.example ../api/.env
docker-compose up --build
```
API: http://localhost:8000 | DB: localhost:5432

### Manual Setup

**API:**
```bash
cd api
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env
uvicorn app.main:app --reload
```

**Web:**
```bash
cd web
npm install
cp .env.local.example .env.local   # Add NEXT_PUBLIC_MAPBOX_TOKEN
npm run dev
```

---

## ⚙️ Environment & Configuration

- **Scope:** USA-only initially (coordinates clamped to continental US)
- **Map:** Mapbox token required (`NEXT_PUBLIC_MAPBOX_TOKEN`)
- **Database:** PostgreSQL + PostGIS (claims use `ST_DWithin` for 2km proximity)
- **JWT Secret:** Change `JWT_SECRET` in production

---

## 📡 Current API Surface (v0)

### Authentication
- `POST /auth/google` - Google OAuth
- `POST /register` - Email/password signup
- `POST /login` - Email/password login
- `POST /api/register` - JSON API version
- `POST /api/login` - JSON API version
- `GET /logout` - Clear auth cookie

### Users
- `GET /me` - Current user profile
- `PATCH /me` - Update bio/avatar
- `GET /users/{user_id}` - View other user profile
- `POST /users/{user_id}/verify` - Verify identity (pending Stripe integration)

### Territories (Claims)
- `POST /claims` - Claim a territory `{ lat, lon, address_label }`
- `GET /nearby?lat&lon&radius_m=2000` - Nearby claims
- `GET /claims` - All claims (paginated)
- `GET /claims/{claim_id}` - Single claim
- `DELETE /claims/{claim_id}` - Delete own claim
- `PATCH /claims/{claim_id}` - Update claim label

### Builds
- `POST /builds` - Create build on claim `{ claim_id, prefab, decal, flag, height_m }`
- `GET /builds?claim_id={id}` - Builds on claim
- `PATCH /builds/{build_id}` - Update build
- `DELETE /builds/{build_id}` - Delete build

### Connections (Friends)
- `POST /connections` - Request friend connection
- `POST /connections/{id}/approve` - Accept friend request
- `GET /connections` - List friends
- `POST /connections/{id}/block` - Block user (planned)

### Chat
- `POST /chatrooms` - Create chat room (DM or group)
- `GET /chatrooms` - My chat rooms
- `GET /chatrooms/top` - Top active rooms
- `POST /chatrooms/access` - Track room access
- `GET /chatrooms/previous` - Recently accessed rooms
- `POST /messages` - Send message
- `GET /messages?room_id=X` - Get messages (paginated)
- `WS /ws/chat/{room_id}` - WebSocket for real-time chat

### Visibility (Fog of War)
- `GET /visibility?lat&lon` - What's visible from location
- `POST /paths/touch` - Update supply path health
- `GET /fog` - User's fog-of-war GeoJSON

### Store
- `GET /store` - Available cosmetics/prefabs
- `POST /store/seed` - Seed demo store items (dev only)

---

## 🎯 What Makes Turf Different

| Feature | Turf | BeReal | Pokémon GO | Discord |
|---------|------|--------|-----------|---------|
| **Location-Based** | ✅ | ❌ | ✅ | ❌ |
| **Social Map** | ✅ | ❌ | ✅ | ❌ |
| **Proof of Presence** | ✅ | ✅ | ❌ | ❌ |
| **Real-World Incentives** | ✅ | ❌ | ✅ | ❌ |
| **Chat/Community** | ✅ | ❌ | ⚠️ | ✅ |
| **Building/Creation** | ✅ | ❌ | ⚠️ | ⚠️ |
| **Leaderboards** | ✅ | ❌ | ✅ | ⚠️ |
| **Cosmetics/Status** | ✅ | ❌ | ✅ | ✅ |

---

## 📋 Beta Testing & Feedback

Join us in shaping Turf! We're looking for:
- Early adopters to claim their territories
- Feedback on UI/UX and app behavior
- Feature requests and ideas
- Reports of bugs

Share feedback: [GitHub Issues](https://github.com/robin-hassan/turf/issues)

---

## 📄 License

See [LICENSE](LICENSE)


