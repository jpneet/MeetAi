# Meet AI - Stream Vision Agent (Gemini Realtime)

Independently runnable Python service that joins Stream Video calls as an AI meeting participant powered by Google Gemini Realtime.

## Architecture

```
User (Browser)
   ↓
Next.js Meet AI frontend (WebRTC)
   ↓
Stream Video Call (default:<meetingId>)
   ↑
Vision Agent (Python + Stream Edge)
   ↓
Google Gemini Realtime (Speech-to-Speech)
```

## Setup & Running

### 1. Install Dependencies
```powershell
python -m uv pip install -e .
# or
python -m pip install -e .
```

### 2. Environment Variables
The service automatically checks both `vision-agent/.env` and `meetai/.env`.
It reuses:
- `NEXT_PUBLIC_STREAM_VIDEO_API_KEY` or `STREAM_API_KEY`
- `STREAM_VIDEO_SECRET_KEY` or `STREAM_API_SECRET`
- `GEMINI_API_KEY` or `GOOGLE_API_KEY`

### 3. Run the Service
```powershell
python main.py
# or using uv:
python -m uv run python main.py
```
The service listens on `http://127.0.0.1:8080` by default.
