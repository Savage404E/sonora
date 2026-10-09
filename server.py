from __future__ import annotations

import json
import os
import re
import threading
import time
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.error import HTTPError, URLError
from urllib.parse import parse_qs, urlencode, unquote, urlsplit
from urllib.request import Request, urlopen


ROOT = Path(__file__).resolve().parent
PORT = int(os.environ.get("PORT", "8000"))
YOUTUBE_API_BASE = "https://www.googleapis.com/youtube/v3"
CACHE_TTL_SECONDS = 600
CACHE_MAX_ITEMS = 32
_cache: dict[str, tuple[float, dict[str, object]]] = {}
_cache_lock = threading.Lock()


def _read_local_api_key() -> str:
    env_path = ROOT / ".env"
    try:
        entries = env_path.read_text(encoding="utf-8-sig").splitlines()
    except FileNotFoundError:
        return ""
    except OSError as error:
        raise RuntimeError("Unable to read the local .env file.") from error

    for entry in entries:
        name, separator, value = entry.partition("=")
        if separator and name.strip() == "YOUTUBE_API_KEY":
            value = value.split("#", 1)[0].strip()
            if len(value) >= 2 and value[0] == value[-1] and value[0] in ("'", '"'):
                value = value[1:-1]
            return value.strip()
    return ""


_api_key = os.environ.get("YOUTUBE_API_KEY") or _read_local_api_key()


def _region_code(value: str) -> str:
    region = value.upper()
    return region if re.fullmatch(r"[A-Z]{2}", region) else "US"


def _send_json(handler: SimpleHTTPRequestHandler, status: int, payload: dict[str, object]) -> None:
    body = json.dumps(payload, ensure_ascii=False).encode("utf-8")
    handler.send_response(status)
    handler.send_header("Content-Type", "application/json; charset=utf-8")
    handler.send_header("Content-Length", str(len(body)))
    handler.send_header("Cache-Control", "no-store")
    handler.end_headers()
    handler.wfile.write(body)


def _request_youtube_api(endpoint: str, params: dict[str, str]) -> dict[str, object]:
    query = urlencode({**params, "key": _api_key})
    request = Request(
        f"{YOUTUBE_API_BASE}/{endpoint}?{query}",
        headers={"Accept": "application/json", "User-Agent": "SonoraLocalMusicPlayer/1.0"},
    )
    with urlopen(request, timeout=15) as response:
        result = json.loads(response.read())
    if not isinstance(result, dict):
        raise ValueError("Unexpected YouTube response.")
    return result


def _cached_request(cache_key: str, endpoint: str, params: dict[str, str]) -> dict[str, object]:
    now = time.monotonic()
    with _cache_lock:
        cached = _cache.get(cache_key)
        if cached and now - cached[0] < CACHE_TTL_SECONDS:
            return cached[1]

    response_payload = _request_youtube_api(endpoint, params)
    items = response_payload.get("items", [])
    if not isinstance(items, list):
        raise ValueError("Unexpected YouTube video list.")
    if endpoint == "search" and items:
        search_ids = [
            item.get("id", {}).get("videoId")
            for item in items
            if isinstance(item, dict) and isinstance(item.get("id"), dict)
        ]
        search_ids = [video_id for video_id in search_ids if isinstance(video_id, str) and re.fullmatch(r"[\w-]{11}", video_id)]
        if search_ids:
            details = _request_youtube_api(
                "videos",
                {
                    "part": "snippet,status,contentDetails",
                    "id": ",".join(search_ids),
                    "regionCode": params.get("regionCode", "US"),
                },
            )
            detail_items = details.get("items", [])
            if not isinstance(detail_items, list):
                raise ValueError("Unexpected YouTube video details.")
            details_by_id = {
                item.get("id"): item
                for item in detail_items
                if isinstance(item, dict) and isinstance(item.get("id"), str)
            }
            items = [details_by_id[video_id] for video_id in search_ids if video_id in details_by_id]

    videos: list[dict[str, str]] = []
    for item in items:
        if not isinstance(item, dict):
            continue
        video_status = item.get("status") or {}
        if not isinstance(video_status, dict):
            continue
        if video_status.get("privacyStatus") != "public" or video_status.get("embeddable") is not True:
            continue
        content_details = item.get("contentDetails") or {}
        region_restriction = content_details.get("regionRestriction", {}) if isinstance(content_details, dict) else {}
        region_code = params.get("regionCode", "US")
        if isinstance(region_restriction, dict):
            allowed_regions = region_restriction.get("allowed")
            blocked_regions = region_restriction.get("blocked", [])
            if isinstance(allowed_regions, list) and region_code not in allowed_regions:
                continue
            if isinstance(blocked_regions, list) and region_code in blocked_regions:
                continue
        video_id = item.get("id")
        if isinstance(video_id, dict):
            video_id = video_id.get("videoId")
        snippet = item.get("snippet") or {}
        if not isinstance(video_id, str) or not re.fullmatch(r"[\w-]{11}", video_id) or not isinstance(snippet, dict):
            continue
        thumbnails = snippet.get("thumbnails") or {}
        thumbnail_url = next(
            (
                thumbnails[size].get("url")
                for size in ("maxres", "standard", "high", "medium", "default")
                if isinstance(thumbnails.get(size), dict) and thumbnails[size].get("url")
            ),
            "",
        )
        thumbnail = urlsplit(thumbnail_url) if isinstance(thumbnail_url, str) else None
        safe_thumbnail = (
            thumbnail_url
            if thumbnail and thumbnail.scheme == "https" and thumbnail.hostname == "i.ytimg.com"
            else ""
        )
        videos.append(
            {
                "id": video_id,
                "title": str(snippet.get("title", ""))[:300],
                "channel": str(snippet.get("channelTitle", ""))[:150],
                "channelId": str(snippet.get("channelId", ""))[:64],
                "publishedAt": str(snippet.get("publishedAt", ""))[:40],
                "thumbnail": safe_thumbnail[:1000],
            }
        )
    result = {"videos": videos}
    with _cache_lock:
        if len(_cache) >= CACHE_MAX_ITEMS:
            oldest = min(_cache, key=lambda key: _cache[key][0])
            _cache.pop(oldest, None)
        _cache[cache_key] = (now, result)
    return result


class SonoraHandler(SimpleHTTPRequestHandler):
    def __init__(self, *args: object, **kwargs: object) -> None:
        super().__init__(*args, directory=str(ROOT), **kwargs)

    def log_message(self, format_string: str, *args: object) -> None:
        return

    def _has_local_host(self) -> bool:
        host = urlsplit(f"//{self.headers.get('Host', '')}").hostname
        return host in {"127.0.0.1", "localhost"}

    def _youtube_response(self, endpoint: str, params: dict[str, str]) -> None:
        if not _api_key:
            _send_json(
                self,
                503,
                {"error": "Add YOUTUBE_API_KEY to the local .env file, then restart Sonora."},
            )
            return

        cache_key = f"{endpoint}:{json.dumps(params, sort_keys=True)}"
        try:
            result = _cached_request(cache_key, endpoint, params)
        except HTTPError as error:
            reason = ""
            try:
                error_payload = json.loads(error.read())
                details = error_payload.get("error", {}).get("errors", [])
                if details and isinstance(details[0], dict):
                    reason = str(details[0].get("reason", ""))
            except (ValueError, AttributeError, TypeError):
                pass
            if reason == "quotaExceeded":
                message = "YouTube API daily quota reached. Try again later."
            elif error.code in (400, 403):
                message = "YouTube API rejected the request. Check that YouTube Data API v3 is enabled and the key is valid."
            else:
                message = "YouTube couldn't load music right now. Try again in a moment."
            _send_json(self, 502, {"error": message})
        except (URLError, TimeoutError):
            _send_json(self, 502, {"error": "Couldn't connect to YouTube. Check your internet connection and try again."})
        except (ValueError, KeyError, TypeError):
            _send_json(self, 502, {"error": "YouTube returned an unexpected response. Please try again."})
        else:
            _send_json(self, 200, result)

    def translate_path(self, path: str) -> str:
        requested_path = unquote(urlsplit(path).path).lstrip("/")
        parts = [part for part in requested_path.split("/") if part not in ("", ".", "..")]
        candidate = ROOT.joinpath(*parts).resolve()
        try:
            candidate.relative_to(ROOT)
        except ValueError:
            return str(ROOT / "__not_found__")
        if any(part.startswith(".") for part in parts):
            return str(ROOT / "__not_found__")
        if candidate.is_dir():
            candidate /= "index.html"
        return str(candidate)

    def do_GET(self) -> None:
        if not self._has_local_host():
            self.send_error(403, "Sonora is available on this computer only.")
            return

        parsed = urlsplit(self.path)
        if parsed.path.startswith("/api/"):
            if parsed.path == "/api/youtube/trending":
                region = _region_code(parse_qs(parsed.query).get("region", ["US"])[0])
                self._youtube_response(
                    "videos",
                    {
                        "part": "snippet,status,contentDetails",
                        "chart": "mostPopular",
                        "videoCategoryId": "10",
                        "regionCode": region,
                        "maxResults": "18",
                    },
                )
            elif parsed.path == "/api/youtube/search":
                query = parse_qs(parsed.query).get("q", [""])[0].strip()
                if len(query) < 2:
                    _send_json(self, 400, {"error": "Enter at least two characters to search for music."})
                    return
                if len(query) > 100:
                    _send_json(self, 400, {"error": "Search terms must be 100 characters or fewer."})
                    return
                self._youtube_response(
                    "search",
                    {
                        "part": "snippet",
                        "type": "video",
                        "videoCategoryId": "10",
                        "maxResults": "18",
                        "q": query,
                        "regionCode": _region_code(parse_qs(parsed.query).get("region", ["US"])[0]),
                    },
                )
            else:
                _send_json(self, 404, {"error": "That Sonora API endpoint doesn't exist."})
            return

        path_parts = [part for part in unquote(parsed.path).split("/") if part]
        if any(part.startswith(".") for part in path_parts):
            self.send_error(404)
            return
        super().do_GET()

    def list_directory(self, path: str) -> None:
        self.send_error(404)


def main() -> None:
    with ThreadingHTTPServer(("127.0.0.1", PORT), SonoraHandler) as server:
        print(f"Sonora is ready at http://127.0.0.1:{PORT}")
        if not _api_key:
            print("YouTube discovery is not configured; add YOUTUBE_API_KEY to .env and restart.")
        try:
            server.serve_forever()
        except KeyboardInterrupt:
            print("\nSonora stopped.")


if __name__ == "__main__":
    main()
