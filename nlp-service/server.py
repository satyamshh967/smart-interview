import json
import os
import sys
from http.server import ThreadingHTTPServer, BaseHTTPRequestHandler
from nlp_engine import NLPEvaluator

PORT = int(os.environ.get("PORT", 8081))
# Loopback by default; containers set HOST=0.0.0.0 on the private compose network.
HOST = os.environ.get("HOST", "127.0.0.1")
MAX_BODY_BYTES = 256 * 1024
MAX_TRANSCRIPT_CHARS = 50_000


class NLPRequestHandler(BaseHTTPRequestHandler):
    # Drop clients that stall mid-request (slowloris) instead of tying up a thread forever
    timeout = 15
    server_version = "NLPService"
    sys_version = ""

    def _send_json(self, status, payload):
        body = json.dumps(payload).encode("utf-8")
        self.send_response(status)
        # No CORS headers: only the API gateway (server-to-server) may call this service.
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.send_header("X-Content-Type-Options", "nosniff")
        self.end_headers()
        self.wfile.write(body)

    def do_GET(self):
        if self.path == "/health":
            self._send_json(200, {
                "status": "UP",
                "service": "Python NLP Feedback Engine",
                "features": [
                    "Technical Terminology Analysis",
                    "Complexity Big-O Extraction",
                    "STAR Method Structural Coherence",
                    "Verbal Filler & Fluency Detection",
                    "Actionable Interview Guidance"
                ]
            })
        else:
            self._send_json(404, {"error": "Route not found"})

    def do_POST(self):
        if self.path != "/nlp/evaluate":
            self._send_json(404, {"error": "Route not found"})
            return

        content_type = (self.headers.get("Content-Type") or "").lower()
        if not content_type.startswith("application/json"):
            self._send_json(415, {"error": "Content-Type must be application/json"})
            return

        try:
            content_length = int(self.headers.get("Content-Length", 0))
        except ValueError:
            content_length = -1
        if content_length < 0 or content_length > MAX_BODY_BYTES:
            self._send_json(413, {"error": "Invalid or too large Content-Length"})
            return

        try:
            body = self.rfile.read(content_length).decode("utf-8", errors="replace")
            data = json.loads(body) if body else {}
            if not isinstance(data, dict):
                raise ValueError("Request body must be a JSON object")

            transcript = str(data.get("transcript", ""))[:MAX_TRANSCRIPT_CHARS]
            problem_context = str(data.get("problemContext", ""))[:1000]
            code = str(data.get("code", ""))[:MAX_BODY_BYTES]
            try:
                time_taken = max(0, int(float(data.get("timeTakenSeconds", 0) or 0)))
            except (TypeError, ValueError):
                time_taken = 0
        except (ValueError, json.JSONDecodeError) as e:
            self._send_json(400, {"error": f"Invalid request: {e}"})
            return

        try:
            result = NLPEvaluator.evaluate(
                transcript=transcript,
                problem_context=problem_context,
                code=code,
                time_taken_seconds=time_taken
            )
            self._send_json(200, result)
        except Exception as e:  # never leak internals; log them instead
            sys.stderr.write(f"[NLP-Service] evaluation failed: {e!r}\n")
            self._send_json(500, {"error": "NLP evaluation failed"})

    def log_message(self, format, *args):
        sys.stdout.write(f"[NLP-Service] {self.address_string()} - {format % args}\n")
        sys.stdout.flush()


def run():
    httpd = ThreadingHTTPServer((HOST, PORT), NLPRequestHandler)
    httpd.daemon_threads = True
    print("=================================================")
    print(f"  Python NLP Feedback Engine on {HOST}:{PORT}")
    print("  Communication Scorer: Active")
    print("  STAR Method & Big-O Analyzer: Active")
    print("=================================================")
    httpd.serve_forever()


if __name__ == "__main__":
    run()
