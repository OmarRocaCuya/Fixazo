# Build/run on Linux x86_64. GPU requires a matching NVIDIA driver/runtime.
# This image does not download any model weights during its build.
FROM python:3.12-slim-bookworm
ARG TORCH_VARIANT=cpu
ENV PYTHONDONTWRITEBYTECODE=1 PYTHONUNBUFFERED=1 \
    HF_HUB_DISABLE_TELEMETRY=1 DO_NOT_TRACK=1 \
    INDIGENOUS_DEVICE=auto INDIGENOUS_WARMUP=false
RUN apt-get update && apt-get install --no-install-recommends -y git libsndfile1 libgomp1 build-essential && rm -rf /var/lib/apt/lists/*
WORKDIR /service
COPY requirements*.txt constraints.txt ./
# Install the exact native variant; mixing Torch/fairseq2 ABIs can segfault.
RUN pip install --no-cache-dir -c constraints.txt torch torchaudio --index-url https://download.pytorch.org/whl/${TORCH_VARIANT} \
    && pip install --no-cache-dir -c constraints.txt fairseq2[arrow] --extra-index-url https://fair.pkg.atmeta.com/fairseq2/whl/pt2.8.0/${TORCH_VARIANT} \
    && pip install --no-cache-dir -r requirements.txt -r requirements-models.txt
RUN useradd --create-home --uid 10001 app
COPY --chown=app:app app.py core.py ./
USER app
ENV FAIRSEQ2_CACHE_DIR=/home/app/.cache/fairseq2 HF_HOME=/home/app/.cache/huggingface
EXPOSE 8080
# A single worker owns the model/semaphore. No audio-bearing access logs.
CMD ["uvicorn", "app:app", "--host", "0.0.0.0", "--port", "8080", "--workers", "1", "--no-access-log", "--log-level", "warning"]
