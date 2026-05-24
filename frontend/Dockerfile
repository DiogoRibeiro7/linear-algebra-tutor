FROM node:20-alpine AS builder

WORKDIR /app

# Enable Corepack so the pinned Yarn version is used
RUN corepack enable

# Copy manifests and Yarn config first for better layer caching
COPY package.json yarn.lock .yarnrc.yml ./

# Install dependencies (immutable enforces lockfile match)
RUN yarn install --immutable

# Copy source code
COPY . .

# Build the app
RUN yarn build

# Production stage
FROM nginx:alpine

# Copy built assets from builder
COPY --from=builder /app/dist /usr/share/nginx/html

# Copy nginx configuration
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
