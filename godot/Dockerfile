FROM debian:bookworm-slim AS exporter
ARG GODOT_VERSION=4.6.3
ENV DEBIAN_FRONTEND=noninteractive XDG_DATA_HOME=/tmp/godot-data XDG_CONFIG_HOME=/tmp/godot-config XDG_CACHE_HOME=/tmp/godot-cache
RUN apt-get update && apt-get install -y --no-install-recommends ca-certificates curl unzip python3 fontconfig && rm -rf /var/lib/apt/lists/*
RUN curl -fL --retry 3 "https://github.com/godotengine/godot-builds/releases/download/${GODOT_VERSION}-stable/Godot_v${GODOT_VERSION}-stable_linux.x86_64.zip" -o /tmp/godot.zip \
 && unzip -q /tmp/godot.zip -d /usr/local/bin \
 && mv /usr/local/bin/Godot_v${GODOT_VERSION}-stable_linux.x86_64 /usr/local/bin/godot \
 && chmod +x /usr/local/bin/godot && rm /tmp/godot.zip
WORKDIR /game
COPY web/install_templates.py /tmp/install_templates.py
RUN python3 /tmp/install_templates.py
COPY . .
RUN mkdir -p build && godot --headless --editor --import --quit && godot --headless --export-release Web build/index.html && python3 web/polish_export.py
FROM python:3.12-slim
WORKDIR /app
COPY --from=exporter /game/build /app/public
COPY web/serve.py /app/serve.py
ENV WEB_ROOT=/app/public PORT=8080 PYTHONUNBUFFERED=1
EXPOSE 8080
CMD ["python","/app/serve.py"]
