# Etapa de construcción
FROM node:lts-alpine AS build-stage
WORKDIR /app

COPY package*.json ./
RUN npm install --production=false

COPY . .
RUN npm run build

# Etapa de producción
FROM node:lts-alpine AS production-stage
RUN apk add --no-cache tzdata
WORKDIR /app

COPY --from=build-stage /app/comp ./comp
COPY --from=build-stage /app/node_modules ./node_modules
COPY --from=build-stage /app/package.json .
COPY /adds ./adds

#Se requiere que Shoukaku siempre este actualizado, lavalink se actualiza solo en su propio Docker
RUN echo '#!/bin/sh' > /entrypoint.sh && \
    echo 'set -e' >> /entrypoint.sh && \
    echo 'echo "=== Actualizando shoukaku a la última versión ==="' >> /entrypoint.sh && \
    echo 'npm install shoukaku@latest --silent --no-audit --no-fund > /dev/null 2>&1' >> /entrypoint.sh && \
    echo 'echo "=== Iniciando Meltryllis ==="' >> /entrypoint.sh && \
    echo 'exec npm start' >> /entrypoint.sh && \
    chmod +x /entrypoint.sh

CMD [ "/entrypoint.sh" ]