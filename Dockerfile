# Multi-stage build for Kubernetes Exam Simulator

# Stage 1: Build frontend
FROM node:18-alpine AS frontend-build

WORKDIR /app/frontend

# Copy frontend package files
COPY app/frontend/package*.json ./

# Clear npm cache and install all dependencies (including dev for build)
RUN npm cache clean --force && npm install --verbose

# Copy frontend source
COPY app/frontend/ ./

# Ensure clean build environment and build frontend
RUN rm -rf node_modules/.cache && npm run build

# Stage 2: Build backend and final image
FROM node:18-alpine

# Install system dependencies
RUN apk add --no-cache \
    bash \
    curl \
    git \
    openssh-client \
    ca-certificates \
    openssl \
    && rm -rf /var/cache/apk/*

# Install kubectl
RUN curl -LO "https://dl.k8s.io/release/$(curl -L -s https://dl.k8s.io/release/stable.txt)/bin/linux/amd64/kubectl" \
    && chmod +x kubectl \
    && mv kubectl /usr/local/bin/

# Install helm
RUN curl -fsSL -o get_helm.sh https://raw.githubusercontent.com/helm/helm/main/scripts/get-helm-3 \
    && chmod 700 get_helm.sh \
    && ./get_helm.sh \
    && rm get_helm.sh

# Create app directory
WORKDIR /app

# Copy backend package files
COPY app/backend/package*.json ./

# Install backend dependencies
RUN npm install --production

# Copy backend source
COPY app/backend/ ./

# Copy built frontend
COPY --from=frontend-build /app/frontend/build ./frontend/build

# Copy helm templates and question bank
COPY helm-templates/ ./helm-templates/
COPY question-bank/ ./question-bank/
COPY scoring-scripts/ ./scoring-scripts/

# Create necessary directories
RUN mkdir -p /tmp/generated-charts \
    && mkdir -p /root/.kube

# Set environment variables
ENV NODE_ENV=production
ENV PORT=8080
ENV KUBECONFIG=/root/.kube/config

# Expose port
EXPOSE 8080

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
    CMD curl -f http://localhost:8080/api/health || exit 1

# Create entrypoint script
COPY docker-entrypoint.sh /usr/local/bin/
RUN chmod +x /usr/local/bin/docker-entrypoint.sh

# Start application
ENTRYPOINT ["/usr/local/bin/docker-entrypoint.sh"]
CMD ["npm", "start"]