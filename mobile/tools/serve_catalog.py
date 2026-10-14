"""Serve the exported Expo demo locally, including extensionless routes."""

import sys
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path


# Uso: python tools/serve_catalog.py [pasta_do_export] [porta]
# Padrão: dist/web na porta 8081 (só 127.0.0.1).
ROOT = Path(__file__).resolve().parents[1]
EXPORT_DIR = (
    (ROOT / sys.argv[1]).resolve() if len(sys.argv) > 1 else ROOT / "dist" / "web"
)
PORT = int(sys.argv[2]) if len(sys.argv) > 2 else 8081


class CatalogHandler(SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(EXPORT_DIR), **kwargs)

    def translate_path(self, path):
        resolved = super().translate_path(path)
        html_file = Path(resolved + ".html")
        if not Path(resolved).exists():
            if html_file.is_file():
                return str(html_file)
            # Rota desconhecida (sem extensão): mostra a tela "não encontrada" do app.
            fallback = EXPORT_DIR / "+not-found.html"
            if not Path(resolved).suffix and fallback.is_file():
                return str(fallback)
        return resolved


if __name__ == "__main__":
    if not (EXPORT_DIR / "catalogo.html").is_file():
        raise SystemExit("Execute npm run export:web em mobile/ primeiro.")
    print(f"App: http://127.0.0.1:{PORT}/ | Catálogo: /catalogo", flush=True)
    with ThreadingHTTPServer(("127.0.0.1", PORT), CatalogHandler) as server:
        try:
            server.serve_forever()
        except KeyboardInterrupt:
            pass
