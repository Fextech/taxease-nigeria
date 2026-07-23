FROM python:3.12-slim

WORKDIR /app

# libgomp1 is required by some pdfplumber/numpy dependencies
RUN apt-get update && apt-get install -y \
    libgomp1 \
    --no-install-recommends && \
    rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY app/ ./app/

# Cloud Run injects PORT; uvicorn default is 8000
EXPOSE 8000

CMD ["uvicorn", "app.main:app", \
     "--host", "0.0.0.0", \
     "--port", "8000", \
     "--proxy-headers", \
     "--forwarded-allow-ips", "*"]
