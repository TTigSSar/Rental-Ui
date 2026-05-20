# ---- Build stage: compile the Angular app ----
FROM node:24-alpine AS build

WORKDIR /app

# Install dependencies first so this layer is cached unless the lockfile changes
COPY package.json package-lock.json ./
RUN npm ci

# Build the production bundle
COPY . .
RUN npm run build

# ---- Runtime stage: serve the static files with nginx ----
FROM nginx:alpine

# SPA-aware server config (routing fallback + cache headers)
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Angular's application builder emits the browser bundle here
COPY --from=build /app/dist/angular-app/browser /usr/share/nginx/html

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
