FROM node:22-alpine AS builder
WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY . .

ARG MONGODB_URI
ENV MONGODB_URI=${MONGODB_URI}

RUN npm run build && npm prune --production

FROM node:22-alpine
WORKDIR /app

COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/public ./public
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./

RUN mkdir -p /app/private/uploads && chmod -R 777 /app/private

ENV NODE_ENV=production
EXPOSE 3001

CMD ["npx", "next", "start", "-H", "0.0.0.0", "-p", "3001"]