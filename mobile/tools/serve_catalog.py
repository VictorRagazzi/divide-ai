"""Serve the exported Expo demo locally, including extensionless routes."""

from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path


EXPORT_DIR = Path(__file__).resolve().parents[1] / "dist" / "web"


class CatalogHandler(SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(EXPORT_DIR), **kwargs)

    def translate_path(self, path):
        resolved = super().translate_path(path)
        html_file = Path(resolved + ".html")
        if not Path(resolved).exists() and html_file.is_file():
            return str(html_file)
        return resolved


if __name__ == "__main__":
    if not (EXPORT_DIR / "catalogo.html").is_file():
        raise SystemExit("Execute npm run export:web em mobile/ primeiro.")
    print("App demo: http://127.0.0.1:8081/ | Catálogo: /catalogo", flush=True)
    with ThreadingHTTPServer(("127.0.0.1", 8081), CatalogHandler) as server:
        try:
            server.serve_forever()
        except KeyboardInterrupt:
            pass
