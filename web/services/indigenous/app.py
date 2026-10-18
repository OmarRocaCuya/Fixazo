"""Private HTTP adapter. Run outside Vercel, on a Linux CPU/GPU service."""

from contextlib import asynccontextmanager
import threading

from fastapi import FastAPI, Request
from starlette.concurrency import run_in_threadpool
from starlette.datastructures import UploadFile
from starlette.responses import JSONResponse

from core import MAX_AUDIO_BYTES, MAX_BODY_BYTES, Runtime, ServiceError, Settings, authorize


class BoundedPrivateRequests:
    """Authenticate before buffering. Never spool a multipart audio file to disk."""

    def __init__(self, app, settings: Settings):
        self.app, self.settings = app, settings

    async def __call__(self, scope, receive, send):
        if scope["type"] != "http":
            return await self.app(scope, receive, send)
        headers = {key.decode("latin-1"): value.decode("latin-1") for key, value in scope.get("headers", [])}
        try:
            authorize(self.settings, headers.get("authorization", ""))
            content_length = headers.get("content-length")
            if content_length is not None:
                try:
                    declared = int(content_length)
                except ValueError:
                    raise ServiceError("invalid-content-length", 400) from None
                if declared < 0 or declared > MAX_BODY_BYTES:
                    raise ServiceError("request-too-large", 413)
            chunks: list[bytes] = []
            size = 0
            while True:
                event = await receive()
                if event["type"] == "http.disconnect":
                    return
                chunk = event.get("body", b"")
                size += len(chunk)
                if size > MAX_BODY_BYTES:
                    raise ServiceError("request-too-large", 413)
                chunks.append(chunk)
                if not event.get("more_body", False):
                    break
            body = b"".join(chunks)
            consumed = False

            async def replay():
                nonlocal consumed
                if not consumed:
                    consumed = True
                    return {"type": "http.request", "body": body, "more_body": False}
                return await receive()

            async def no_cache(event):
                if event["type"] == "http.response.start":
                    event["headers"].append((b"cache-control", b"no-store, private"))
                await send(event)

            await self.app(scope, replay, no_cache)
        except ServiceError as error:
            await JSONResponse({"error": error.code}, status_code=error.status, headers={"Cache-Control": "no-store, private", "Retry-After": "5"} if error.status == 503 else {"Cache-Control": "no-store, private"})(scope, receive, send)


def create_app(settings: Settings | None = None, engine: Runtime | None = None) -> FastAPI:
    settings = settings or Settings.from_env()
    engine = engine or Runtime(settings)

    @asynccontextmanager
    async def lifespan(_app):
        if settings.warmup and settings.configured:
            # Explicit opt-in: may download GB of weights. The server remains
            # responsive with loading=true, ready=false until real load ends.
            threading.Thread(target=engine.warmup, daemon=True, name="model-warmup").start()
        yield

    api = FastAPI(title="Ñawinchay · servicio privado Meta", docs_url=None, redoc_url=None, openapi_url=None, lifespan=lifespan)
    api.add_middleware(BoundedPrivateRequests, settings=settings)

    @api.exception_handler(ServiceError)
    async def known_error(_request, error):
        return JSONResponse({"error": error.code}, status_code=error.status, headers={"Retry-After": "5"} if error.status == 503 else None)

    @api.get("/health")
    async def health():
        # This probes configuration/load state, NOT model quality or accuracy.
        return engine.status()

    @api.post("/transcribe")
    async def transcribe(request: Request):
        if not request.headers.get("content-type", "").startswith("multipart/form-data"):
            raise ServiceError("multipart-required", 415)
        try:
            async with request.form(max_files=1, max_fields=1, max_part_size=MAX_BODY_BYTES) as form:
                if len(form.multi_items()) != 2 or set(form.keys()) != {"file", "language"} or not isinstance(form["file"], UploadFile):
                    raise ServiceError("file-and-language-required", 422)
                audio = await form["file"].read(MAX_AUDIO_BYTES + 1)
                language = form["language"]
                return await run_in_threadpool(engine.transcribe, audio, language)
        except ServiceError:
            raise
        except Exception:
            raise ServiceError("invalid-multipart-audio", 422) from None

    @api.post("/translate")
    async def translate(request: Request):
        if request.headers.get("content-type", "").split(";")[0] != "application/json":
            raise ServiceError("json-required", 415)
        raw = await request.body()
        if len(raw) > 16_000:
            raise ServiceError("translation-request-too-large", 413)
        try:
            payload = await request.json()
        except Exception:
            raise ServiceError("invalid-json", 400) from None
        return await run_in_threadpool(engine.translate, payload)

    return api


app = create_app()
