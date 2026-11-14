FROM debian:bookworm-slim AS godot-export
ARG GODOT_VERSION=4.6.3
ENV DEBIAN_FRONTEND=noninteractive XDG_DATA_HOME=/tmp/godot-data XDG_CONFIG_HOME=/tmp/godot-config XDG_CACHE_HOME=/tmp/godot-cache
RUN apt-get update && apt-get install -y --no-install-recommends ca-certificates curl unzip python3 fontconfig && rm -rf /var/lib/apt/lists/*
RUN curl -fL --retry 3 "https://github.com/godotengine/godot-builds/releases/download/${GODOT_VERSION}-stable/Godot_v${GODOT_VERSION}-stable_linux.x86_64.zip" -o /tmp/godot.zip \
 && unzip -q /tmp/godot.zip -d /usr/local/bin \
 && mv /usr/local/bin/Godot_v${GODOT_VERSION}-stable_linux.x86_64 /usr/local/bin/godot \
 && chmod +x /usr/local/bin/godot && rm /tmp/godot.zip
WORKDIR /game
COPY godot/web/install_templates.py /tmp/install_templates.py
RUN python3 /tmp/install_templates.py
COPY godot/ .
RUN mkdir -p build && godot --headless --editor --import --quit && godot --headless --export-release Web build/index.html && python3 web/polish_export.py
FROM node:22-bookworm-slim AS web-build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npm run build
FROM node:22-bookworm-slim
WORKDIR /app
ENV NODE_ENV=production PORT=8080
COPY --from=web-build /app/dist /app/dist
COPY --from=web-build /app/node_modules/ws /app/node_modules/ws
COPY --from=godot-export /game/build /app/dist/godot
COPY server/ /app/server/
EXPOSE 8080
CMD ["node","server/index.mjs"]
