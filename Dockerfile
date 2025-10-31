# syntax=docker/dockerfile:1

FROM node:20-alpine AS builder
WORKDIR /app
ENV CI=true
COPY package*.json ./
RUN npm ci --include=dev
COPY . .
RUN npm run build

FROM node:20-alpine AS runner
WORKDIR /app
RUN npm install -g serve@14
ENV NODE_ENV=production
ENV PORT=3000
EXPOSE 3000
COPY --from=builder /app/dist ./dist
CMD ["sh", "-c", "serve -s dist -l ${PORT:-3000}"]


