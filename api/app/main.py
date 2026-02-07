import asyncio
from typing import List, Optional

from fastapi import Depends, FastAPI, HTTPException, Request, Response, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import RedirectResponse, JSONResponse
from fastapi.templating import Jinja2Templates
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.sql import func

from .config import settings
from .database import Base, engine, get_session
from .models import Build, Claim, User
from .schemas import BuildCreate, BuildOut, ClaimCreate, ClaimOut, NearbyQuery, UserCreate, UserOut
from .routes import router as api_router
from .deps import get_current_user_optional

app = FastAPI(
    title=settings.app_name,
    version="0.1.0",
    description="A collaborative geospatial application for exploring and building in shared worlds. Features user authentication, social connections, real-time chat, and FOG-based visibility mechanics.",
    openapi_url="/openapi.json",
    docs_url=None,  # Disable default docs
    redoc_url=None,  # Disable default redoc
)

# Override OpenAPI schema to use 3.0.3 instead of 3.1.0 for Swagger UI compatibility
def custom_openapi():
    if app.openapi_schema:
        return app.openapi_schema
    
    from fastapi.openapi.utils import get_openapi
    
    openapi_schema = get_openapi(
        title=app.title,
        version=app.version,
        description=app.description,
        routes=app.routes,
        openapi_version="3.0.3",  # Force 3.0.3 for Swagger UI v3 compatibility
    )
    
    # Add security schemes for Bearer token authentication
    openapi_schema["components"] = openapi_schema.get("components", {})
    openapi_schema["components"]["securitySchemes"] = {
        "bearer": {
            "type": "http",
            "scheme": "bearer",
            "bearerFormat": "JWT",
            "description": "Enter your JWT token from /api/login"
        }
    }
    
    # Add security requirement to all endpoints (except auth endpoints)
    openapi_schema["security"] = [{"bearer": []}]
    
    app.openapi_schema = openapi_schema
    return app.openapi_schema

app.openapi = custom_openapi

# Initialize Jinja2 templates
templates = Jinja2Templates(directory="app/templates")

app.add_middleware(
    CORSMiddleware,
    allow_origins=[settings.allowed_origin] if settings.allowed_origin != "*" else ["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("startup")
async def startup_event():
    """Initialize database tables on application startup."""
    # Ensure tables exist in local/dev. In prod use migrations.
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

app.include_router(api_router)


@app.get("/openapi.json", tags=["Documentation"], include_in_schema=False)
async def get_openapi():
    """Get the OpenAPI schema."""
    return JSONResponse(app.openapi())


@app.get("/", tags=["Pages"])
async def root(current_user: Optional[User] = Depends(get_current_user_optional)):
    """
    Root endpoint redirects to home if authenticated, login if not.
    """
    if current_user:
        return RedirectResponse(url="/home", status_code=status.HTTP_302_FOUND)
    return RedirectResponse(url="/login", status_code=status.HTTP_302_FOUND)


@app.get("/health", tags=["Health"])
async def health():
    """Check if the API is running and healthy."""
    return {"status": "ok"}


@app.get("/docs", tags=["Documentation"])
async def docs_redirect(current_user: Optional[User] = Depends(get_current_user_optional)):
    """
    Redirect to API documentation.
    
    Only authenticated users can access the interactive API docs.
    If not logged in, redirects to login page.
    """
    if not current_user:
        return RedirectResponse(url="/login", status_code=status.HTTP_302_FOUND)
    
    from fastapi.responses import HTMLResponse
    
    html = """
    <!DOCTYPE html>
    <html>
    <head>
        <title>Turf API Docs</title>
        <meta charset="utf-8"/>
        <meta name="viewport" content="width=device-width, initial-scale=1">
        <link rel="stylesheet" href="https://unpkg.com/swagger-ui-dist@3/swagger-ui.css">
        <style>
            html {
                box-sizing: border-box;
                overflow: -moz-scrollbars-vertical;
                overflow-y: scroll;
            }
            *, *:before, *:after {
                box-sizing: inherit;
            }
            body {
                margin: 0;
                padding: 0;
            }
        </style>
    </head>
    <body>
        <div id="swagger-ui"></div>
        <script src="https://unpkg.com/swagger-ui-dist@3/swagger-ui.js"></script>
        <script src="https://unpkg.com/swagger-ui-dist@3/swagger-ui-bundle.js"></script>
        <script>
            window.onload = function() {
                const ui = SwaggerUIBundle({
                    url: "/openapi.json",
                    dom_id: '#swagger-ui',
                    deepLinking: true,
                    presets: [
                        SwaggerUIBundle.presets.apis,
                        SwaggerUIBundle.SwaggerUIStandalonePreset
                    ],
                    plugins: [
                        SwaggerUIBundle.plugins.DownloadUrl
                    ],
                    layout: "BaseLayout",
                    requestInterceptor: (request) => {
                        // Ensure cookies are sent with requests for SSR auth
                        request.credentials = 'include';
                        return request;
                    },
                    onComplete: function() {
                        // Restore token from localStorage if exists
                        const savedToken = localStorage.getItem('swagger_ui_token');
                        if (savedToken) {
                            ui.preauthorizeApiKey('bearer', savedToken);
                        }
                    }
                })
                
                // Store token when user authorizes via Swagger UI
                window.onAuthorize = function(token) {
                    localStorage.setItem('swagger_ui_token', token);
                }
            }
        </script>
    </body>
    </html>
    """
    return HTMLResponse(html)


@app.get("/redoc", tags=["Documentation"])
async def redoc_redirect(current_user: Optional[User] = Depends(get_current_user_optional)):
    """
    Redirect to ReDoc documentation.
    
    Only authenticated users can access the ReDoc API docs.
    """
    if not current_user:
        return RedirectResponse(url="/login", status_code=status.HTTP_302_FOUND)
    
    from fastapi.openapi.docs import get_redoc_html
    return get_redoc_html(
        openapi_url="/openapi.json",
        title="ReDoc",
        redoc_js_url="https://cdn.jsdelivr.net/npm/redoc@latest/bundles/redoc.standalone.js",
    )


@app.get("/login", tags=["Authentication"])
async def login_page(
    request: Request,
    current_user: Optional[User] = Depends(get_current_user_optional)
):
    """
    Display login page.
    
    If already logged in, redirects to /home.
    Shows options for email/password login and Google Sign-In.
    """
    if current_user:
        return RedirectResponse(url="/home", status_code=status.HTTP_302_FOUND)
    
    return templates.TemplateResponse("login.html", {"request": request})


@app.get("/register", tags=["Authentication"])
async def register_page(
    request: Request,
    current_user: Optional[User] = Depends(get_current_user_optional)
):
    """
    Display registration page.
    
    If already logged in, redirects to /home.
    Shows form for creating new account with email, handle, and password.
    """
    if current_user:
        return RedirectResponse(url="/home", status_code=status.HTTP_302_FOUND)
    
    return templates.TemplateResponse("register.html", {"request": request})


@app.get("/home", tags=["Pages"])
async def home(
    request: Request,
    current_user: User = Depends(get_current_user_optional)
):
    """
    Home page for logged-in users.
    
    Redirects to login if not authenticated.
    """
    if not current_user:
        return RedirectResponse(url="/login", status_code=status.HTTP_302_FOUND)
    
    return templates.TemplateResponse(
        "home.html",
        {
            "request": request,
            "handle": current_user.handle,
            "email": current_user.email,
            "bio": current_user.bio,
            "verified": current_user.verified,
        }
    )


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
