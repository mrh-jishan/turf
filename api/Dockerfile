FROM python:3.11-slim

WORKDIR /app

# Install system dependencies
RUN apt-get update && apt-get install -y gcc libpq-dev && rm -rf /var/lib/apt/lists/*

# Install uv
RUN pip install --no-cache-dir uv

# Copy project files
COPY pyproject.toml ./
COPY app ./app

# Install dependencies
RUN uv pip install --system --no-cache \
    fastapi==0.115.0 \
    uvicorn[standard]==0.23.2 \
    SQLAlchemy==2.0.23 \
    asyncpg==0.29.0 \
    psycopg2-binary==2.9.9 \
    geoalchemy2==0.14.4 \
    python-dotenv==1.0.1 \
    pydantic==1.10.14 \
    python-jose[cryptography]==3.3.0 \
    passlib[bcrypt]==1.7.4 \
    python-multipart==0.0.9

# Copy application
COPY app ./app
ENV PYTHONPATH=/app

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
