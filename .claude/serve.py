import os, sys
os.chdir('/Users/diogomaiacaetano/Downloads/Papertray')
import http.server, socketserver
PORT = 5173
Handler = http.server.SimpleHTTPRequestHandler
with socketserver.TCPServer(("", PORT), Handler) as httpd:
    httpd.serve_forever()
