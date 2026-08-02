FROM node:22-slim
RUN apt-get update && apt-get install -y --no-install-recommends \
    python3 make g++ ca-certificates && rm -rf /var/lib/apt/lists/*
WORKDIR /app
ENV NODE_ENV=production
COPY package.json package-lock.json ./
RUN npm install --no-audit --no-fund --legacy-peer-deps pg@^8.13
COPY . .
RUN npm run build
EXPOSE 1337
CMD ["npm","run","start"]
