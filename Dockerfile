# Multi-stage build for Kubernetes Exam Simulator

# Stage 1: Build frontend
FROM node:18-alpine AS frontend-build

# Install build dependencies in one layer
RUN apk add --no-cache python3 make g++ && \
    npm config set fund false && \
    npm config set audit-level none

WORKDIR /app/frontend

# Copy frontend package files first (for better layer caching)
COPY app/frontend/package*.json ./
COPY app/frontend/craco.config.js ./
COPY app/frontend/.env ./

# Install dependencies with aggressive optimizations for faster builds
ENV GENERATE_SOURCEMAP=false
ENV DISABLE_ESLINT_PLUGIN=true
ENV SKIP_PREFLIGHT_CHECK=true
ENV NODE_OPTIONS="--max-old-space-size=4096"

RUN npm ci --omit=optional --ignore-scripts --silent --prefer-offline --no-audit --no-fund

# Copy frontend source after dependency installation
COPY app/frontend/ ./

# Build frontend application with production optimizations
# Set environment variables for build
ENV CI=false
ENV GENERATE_SOURCEMAP=false
ENV DISABLE_ESLINT_PLUGIN=true
ENV TSC_COMPILE_ON_ERROR=true

# Build frontend with better error handling
RUN npm run build || (echo "Frontend build failed, checking for errors..."; ls -la; cat package.json; exit 1)

# Verify build was successful
RUN ls -la build/ && test -f build/index.html || (echo "Build verification failed - index.html not found"; exit 1)

# Stage 2: Build backend and final image
FROM node:18-alpine

# Install system dependencies in single layer
RUN apk add --no-cache \
    bash \
    curl \
    git \
    openssh-client \
    ca-certificates \
    openssl \
    util-linux \
    ncurses-terminfo \
    coreutils \
    procps \
    && rm -rf /var/cache/apk/*

# Install kubectl and helm in single layer to minimize image size
RUN KUBECTL_VERSION=$(curl -L -s https://dl.k8s.io/release/stable.txt) && \
    curl -LO "https://dl.k8s.io/release/${KUBECTL_VERSION}/bin/linux/amd64/kubectl" && \
    chmod +x kubectl && \
    mv kubectl /usr/local/bin/ && \
    curl -fsSL -o get_helm.sh https://raw.githubusercontent.com/helm/helm/main/scripts/get-helm-3 && \
    chmod 700 get_helm.sh && \
    ./get_helm.sh && \
    rm get_helm.sh

# Create app directory
WORKDIR /app

# Copy backend package files for dependency layer caching
COPY app/backend/package*.json ./

# Install backend production dependencies with optimizations
RUN npm ci --omit=dev --ignore-scripts --silent --no-audit --no-fund

# Copy backend source code
COPY app/backend/ ./

# Copy built frontend from previous stage
COPY --from=frontend-build /app/frontend/build ./frontend/build

# Copy configuration files and templates
COPY helm-templates/ ./helm-templates/
COPY question-bank/ ./question-bank/

# Don't copy generated charts - they'll be created at runtime
# Create the directory structure for generated charts
RUN mkdir -p /app/generated-charts

COPY docker-entrypoint.sh /usr/local/bin/

# Set up permissions and directories in one layer
RUN chmod +x /usr/local/bin/docker-entrypoint.sh && \
    mkdir -p /root/.kube && \
    chmod -R 755 /app/generated-charts

# Set production environment variables
ENV NODE_ENV=production \
    PORT=8080 \
    KUBECONFIG=/root/.kube/config \
    TERM=xterm \
    SHELL=/bin/bash \
    GENERATED_CHARTS_PATH=/app/generated-charts \
    QUESTION_BANK_PATH=/app/question-bank \
    HELM_TEMPLATES_PATH=/app/helm-templates

# Expose application port
EXPOSE 8080

# Health check with proper endpoint
HEALTHCHECK --interval=30s --timeout=3s --start-period=10s --retries=3 \
    CMD curl -f http://localhost:8080/api/health || exit 1

# Set up entrypoint and default command
ENTRYPOINT ["/usr/local/bin/docker-entrypoint.sh"]
CMD ["npm", "start"]