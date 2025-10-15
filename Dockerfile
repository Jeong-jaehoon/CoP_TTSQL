# Multi-stage build for TTSQL Application with Ollama

FROM node:20-slim AS node-builder

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci --only=production

# Copy application files
COPY server.js .
COPY config.js .
COPY api.js .
COPY index.html .
COPY *.sql ./
COPY images/ ./images/

# Final stage with Ollama
FROM debian:bookworm-slim

# Install required packages
RUN apt-get update && apt-get install -y \
    curl \
    ca-certificates \
    sqlite3 \
    && rm -rf /var/lib/apt/lists/*

# Install Node.js
RUN curl -fsSL https://deb.nodesource.com/setup_20.x | bash - \
    && apt-get install -y nodejs \
    && rm -rf /var/lib/apt/lists/*

# Install Ollama
RUN curl -fsSL https://ollama.com/install.sh | sh

# Create app directory
WORKDIR /app

# Copy Node.js app from builder
COPY --from=node-builder /app /app

# Copy Modelfile
COPY Modelfile /app/Modelfile

# Create database directory
RUN mkdir -p /app/.wrangler/state/v3/d1/miniflare-D1DatabaseObject

# Copy startup script
COPY docker-entrypoint.sh /app/docker-entrypoint.sh
RUN chmod +x /app/docker-entrypoint.sh

# Expose ports
EXPOSE 8787 11434

# Set environment variables
ENV NODE_ENV=production
ENV PORT=8787

# Start script
ENTRYPOINT ["/app/docker-entrypoint.sh"]
