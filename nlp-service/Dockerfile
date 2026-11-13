# Python NLP Feedback Engine
FROM python:3.12-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    HOST=0.0.0.0
WORKDIR /app
COPY . /app

RUN useradd --system --no-create-home app
USER app

EXPOSE 8081

CMD ["python", "server.py"]
