# Serveur local pour les captures : http.server + POST /captures/<nom>.jpg|json, enregistré dans captures/ (ignoré par git).
# Usage, depuis la racine du dépôt : python outils/capture.py 8801   puis ouvrir http://127.0.0.1:8801/outils/captures.html?carte=wangan
import http.server, os, re, sys
class H(http.server.SimpleHTTPRequestHandler):
    def do_POST(self):
        m = re.fullmatch(r'/captures/([\w-]+\.(?:jpg|json))', self.path)
        if not m: self.send_error(403); return
        os.makedirs('captures', exist_ok=True)
        with open(os.path.join('captures', m.group(1)), 'wb') as f: f.write(self.rfile.read(int(self.headers['Content-Length'])))
        self.send_response(204); self.end_headers()
    def end_headers(self):
        self.send_header('Cache-Control', 'no-store'); super().end_headers()  # toujours le code du disque, jamais celui du cache
    def log_message(self, *a): pass
http.server.ThreadingHTTPServer(('127.0.0.1', int(sys.argv[1]) if len(sys.argv) > 1 else 8801), H).serve_forever()
