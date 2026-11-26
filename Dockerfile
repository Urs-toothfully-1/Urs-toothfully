# Railway image for Ur's Toothfully (Next.js 16 + Prisma + headless Chromium for PDFs).
# Vercel ignores this file — it builds from package.json as before.
FROM node:22-bookworm-slim

# Chromium renders prescription / invoice / receipt PDFs (puppeteer-core).
# Noto fonts so ₹ and Indian-language names print; openssl for Prisma.
RUN apt-get update \
  && apt-get install -y --no-install-recommends chromium fonts-noto-core fonts-noto-color-emoji openssl ca-certificates \
  && rm -rf /var/lib/apt/lists/*

ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium \
    TZ=Asia/Kolkata \
    NEXT_TELEMETRY_DISABLED=1

WORKDIR /app

COPY package.json package-lock.json ./
COPY prisma ./prisma
RUN npm ci

# Build-time variables: NEXT_PUBLIC_* and JWT_SECRET are inlined by `next build`
# (see next.config.ts). Railway passes service variables to matching ARGs.
ARG DATABASE_URL
ARG DIRECT_URL
ARG JWT_SECRET
ARG NEXT_PUBLIC_APP_URL
ARG NEXT_PUBLIC_SITE_URL
ARG NEXT_PUBLIC_CLINIC_NAME
ARG NEXT_PUBLIC_GOOGLE_CLIENT_ID

COPY . .
# Small servers (1 GB RAM + swap): let the build's Node heap use the swap instead
# of aborting at V8's default limit (~half of RAM). Build-time only.
RUN NODE_OPTIONS=--max-old-space-size=2048 npm run build

ENV NODE_ENV=production
EXPOSE 3000
# `next start` listens on $PORT, which Railway sets.
CMD ["npm", "start"]
