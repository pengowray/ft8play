#!/usr/bin/env python3
"""Serves docs/ for local testing with caching turned off, so edited modules and .wasm files load on reload."""
import http.server
import sys
from functools import partial
from pathlib import Path


class NoCacheHandler(http.server.SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header('Cache-Control', 'no-store')
        super().end_headers()


port = int(sys.argv[1]) if len(sys.argv) > 1 else 8737
docs = Path(__file__).resolve().parent.parent / 'docs'
handler = partial(NoCacheHandler, directory=str(docs))
handler.extensions_map = {**http.server.SimpleHTTPRequestHandler.extensions_map, '.wasm': 'application/wasm', '.js': 'text/javascript'}
http.server.ThreadingHTTPServer(('127.0.0.1', port), handler).serve_forever()
