"""Static Godot Web server: correct MIME types, isolation headers and Railway port."""
import http.server
import os
from pathlib import Path

class Handler(http.server.SimpleHTTPRequestHandler):
    extensions_map = {**http.server.SimpleHTTPRequestHandler.extensions_map,
                      '.wasm':'application/wasm','.pck':'application/octet-stream',
                      '.js':'application/javascript'}
    def end_headers(self):
        self.send_header('Cross-Origin-Opener-Policy','same-origin')
        self.send_header('Cross-Origin-Embedder-Policy','require-corp')
        self.send_header('X-Content-Type-Options','nosniff')
        self.send_header('Cache-Control','no-cache' if self.path.split('?')[0].endswith(('.html','/')) else 'public, max-age=3600')
        super().end_headers()
    def do_HEAD(self):
        if self.path=='/health':
            self.send_response(200)
            self.send_header('Content-Type','text/plain; charset=utf-8')
            self.end_headers()
            return
        super().do_HEAD()
    def do_GET(self):
        if self.path=='/health':
            self.send_response(200)
            self.send_header('Content-Type','text/plain; charset=utf-8')
            self.end_headers()
            self.wfile.write(b'Fortune Empire OK')
            return
        super().do_GET()

if __name__=='__main__':
    os.chdir(os.environ.get('WEB_ROOT',str(Path(__file__).resolve().parents[1]/'build')))
    port = int(os.environ.get('PORT','8080'))
    print(f'Fortune Empire listening on 0.0.0.0:{port}',flush=True)
    http.server.ThreadingHTTPServer(('0.0.0.0',port),Handler).serve_forever()
