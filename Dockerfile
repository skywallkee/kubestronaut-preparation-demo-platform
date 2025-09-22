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

# Install kubectl and helm with architecture detection and Mac compatibility fixes
RUN set -ex && \
    # Detect architecture for proper binary downloads
    ARCH=$(uname -m) && \
    case $ARCH in \
        x86_64) KUBECTL_ARCH="amd64" ;; \
        aarch64|arm64) KUBECTL_ARCH="arm64" ;; \
        *) echo "Unsupported architecture: $ARCH" && exit 1 ;; \
    esac && \
    echo "Detected architecture: $ARCH, using kubectl arch: $KUBECTL_ARCH" && \
    # Download kubectl with proper architecture
    KUBECTL_VERSION=$(curl -L -s https://dl.k8s.io/release/stable.txt) && \
    echo "Downloading kubectl version: $KUBECTL_VERSION for $KUBECTL_ARCH" && \
    curl -LO "https://dl.k8s.io/release/${KUBECTL_VERSION}/bin/linux/${KUBECTL_ARCH}/kubectl" && \
    chmod +x kubectl && \
    mv kubectl /usr/local/bin/ && \
    # Install helm with architecture detection
    export HELM_INSTALL_DIR=/usr/local/bin && \
    curl -fsSL -o get_helm.sh https://raw.githubusercontent.com/helm/helm/main/scripts/get-helm-3 && \
    chmod 700 get_helm.sh && \
    ./get_helm.sh && \
    rm get_helm.sh && \
    # Verify installations
    kubectl version --client || echo "kubectl client check completed" && \
    helm version || echo "helm version check completed"

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

# Set up permissions and directories in one layer with Mac compatibility
RUN chmod +x /usr/local/bin/docker-entrypoint.sh && \
    mkdir -p /root/.kube && \
    chmod -R 755 /app/generated-charts && \
    # Create Helm directories to prevent permission issues on Mac
    mkdir -p /tmp/helm-cache /tmp/helm-config /tmp/helm-data && \
    chmod -R 755 /tmp/helm-cache /tmp/helm-config /tmp/helm-data

# Set production environment variables with Mac compatibility fixes
ENV NODE_ENV=production \
    PORT=8080 \
    KUBECONFIG=/root/.kube/config \
    TERM=xterm \
    SHELL=/bin/bash \
    GENERATED_CHARTS_PATH=/app/generated-charts \
    QUESTION_BANK_PATH=/app/question-bank \
    HELM_TEMPLATES_PATH=/app/helm-templates \
    # Go runtime fixes for Mac compatibility
    GODEBUG=madvdontneed=1 \
    GOGC=100 \
    GOMEMLIMIT=256MiB \
    # Additional kubectl/helm environment fixes
    KUBECTL_DISABLE_CACHE=true \
    HELM_CACHE_HOME=/tmp/helm-cache \
    HELM_CONFIG_HOME=/tmp/helm-config \
    HELM_DATA_HOME=/tmp/helm-data

# Expose application port
EXPOSE 8080

# Health check with proper endpoint
HEALTHCHECK --interval=30s --timeout=3s --start-period=10s --retries=3 \
    CMD curl -f http://localhost:8080/api/health || exit 1

# Set up entrypoint and default command
ENTRYPOINT ["/usr/local/bin/docker-entrypoint.sh"]
CMD ["npm", "start"]