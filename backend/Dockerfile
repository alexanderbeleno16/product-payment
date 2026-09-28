FROM node:24.20.0-alpine AS build

WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY nest-cli.json tsconfig.json tsconfig.build.json ./
COPY src ./src
RUN npm run build

FROM node:24.20.0-alpine AS production-dependencies

WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force

FROM node:24.20.0-alpine

ENV NODE_ENV=production
ENV NODE_EXTRA_CA_CERTS=/app/certs/us-east-1-bundle.pem
WORKDIR /app
COPY --chown=node:node certs/us-east-1-bundle.pem ./certs/us-east-1-bundle.pem
COPY --from=production-dependencies --chown=node:node /app/node_modules ./node_modules
COPY --from=build --chown=node:node /app/dist ./dist
COPY --chown=node:node package.json ./package.json
USER node
EXPOSE 3000
CMD ["node", "dist/main.js"]
