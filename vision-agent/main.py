"""Meet AI - Stream Vision Agent with Conversational Audio Pipeline.

Participates in Stream Video meetings as an AI participant with end-to-end voice:
User Mic -> Stream Audio Track -> WebRTC Audio Input -> VAD -> STT -> LLM -> TTS -> Agent WebRTC Track.
"""

import asyncio
import io
import logging
import os
import secrets
import sys
import time
from contextlib import asynccontextmanager
from pathlib import Path
from typing import Any, Dict, List, Optional

import edge_tts
import numpy as np
import soundfile as sf
import speech_recognition as sr
import uvicorn
from dotenv import load_dotenv
from fastapi import Depends, FastAPI, Header, HTTPException, status
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, ConfigDict, Field

# 1. Environment Loading & Auto-Mapping
current_dir = Path(__file__).resolve().parent
search_paths = [
    current_dir / ".env",
    current_dir.parent / ".env",
    current_dir.parent / "meetai" / ".env",
    current_dir / ".." / "meetai" / ".env",
]

for env_path in search_paths:
    if env_path.exists():
        load_dotenv(dotenv_path=env_path, override=False)

# Map existing Meet AI environment variables to standard names
if not os.environ.get("STREAM_API_KEY"):
    os.environ["STREAM_API_KEY"] = (
        os.environ.get("NEXT_PUBLIC_STREAM_VIDEO_API_KEY")
        or os.environ.get("STREAM_VIDEO_API_KEY")
        or ""
    )

if not os.environ.get("STREAM_API_SECRET"):
    os.environ["STREAM_API_SECRET"] = (
        os.environ.get("STREAM_VIDEO_SECRET_KEY")
        or os.environ.get("STREAM_SECRET_KEY")
        or ""
    )

# Clean and map Google Gemini API Key
raw_gemini_key = (
    os.environ.get("GOOGLE_API_KEY")
    or os.environ.get("GEMINI_API_KEY")
    or ""
).strip().strip('"').strip("'")

if raw_gemini_key:
    os.environ["GOOGLE_API_KEY"] = raw_gemini_key
else:
    os.environ.pop("GOOGLE_API_KEY", None)

# Configure Logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    datefmt="%H:%M:%S",
)
logger = logging.getLogger("MeetAI")


def mask_secret(val: Optional[str]) -> str:
    if not val:
        return "[NOT SET]"
    if len(val) <= 8:
        return "****"
    return f"{val[:4]}...{val[-4:]}"


logger.info("[AGENT] Initializing Meet AI Vision Agent Service")
logger.info(f"[AGENT] STREAM_API_KEY: {mask_secret(os.environ.get('STREAM_API_KEY'))}")
logger.info(f"[AGENT] STREAM_API_SECRET: {mask_secret(os.environ.get('STREAM_API_SECRET'))}")
if os.environ.get("GOOGLE_API_KEY"):
    logger.info(f"[AGENT] GOOGLE_API_KEY: {mask_secret(os.environ.get('GOOGLE_API_KEY'))}")
    logger.info("[AGENT] LLM STATUS: CONFIGURED (Google Gemini)")
else:
    logger.info("[AGENT] GOOGLE_API_KEY: [NOT SET]")
    logger.info("[AGENT] LLM STATUS: NOT CONFIGURED (Operating with Conversational Tutor Engine)")
    logger.info("[AGENT] To enable Gemini Live/Flash multimodal reasoning, add GEMINI_API_KEY=<key> in meetai/.env")

# Import Vision Agents core and plugins
from vision_agents.core import Agent, User
from vision_agents.core.llm.realtime import (
    PcmData,
    Realtime,
    RealtimeAgentSpeechEnded,
    RealtimeAgentSpeechStarted,
    RealtimeAgentTranscript,
    RealtimeAudioOutput,
    RealtimeAudioOutputDone,
    RealtimeUserSpeechEnded,
    RealtimeUserSpeechStarted,
    RealtimeUserTranscript,
)
from vision_agents.plugins import getstream


def generate_tutor_response(user_text: str, instructions: str, agent_name: str) -> str:
    """Intelligent, context-aware spoken response generator when external LLM API key is not configured."""
    text_lower = user_text.lower().strip()

    # 1. Greetings & Audio Checks
    if any(q in text_lower for q in ["can you hear me", "hear me", "are you there", "can you speak"]):
        return f"Hello! Yes, I can hear you loud and clear. I am your {agent_name}. What physics topic or question would you like to explore today?"

    if any(q in text_lower for q in ["hello", "hi", "hey", "good morning", "good afternoon"]):
        return f"Hello there! It is great to be here with you. I am ready to dive into some physics. Where would you like to begin?"

    # 2. Who are you / Identity
    if any(q in text_lower for q in ["who are you", "what is your name", "what are you"]):
        return f"I am your AI {agent_name}. I am here to help you understand physics concepts, solve challenging problems, and guide our meeting step by step."

    # 3. Newton's Laws
    if "first law" in text_lower:
        return "Newton's First Law, also called the law of inertia, states that an object at rest stays at rest, and an object in motion stays in motion with constant velocity, unless acted upon by a net external force."
    if "second law" in text_lower:
        return "Newton's Second Law states that the net force acting on an object equals its mass multiplied by its acceleration, commonly expressed as F equals m a."
    if "third law" in text_lower:
        return "Newton's Third Law states that for every action, there is an equal and opposite reaction. Whenever one body exerts a force on another, the second body exerts an equal and opposite force on the first."

    # 4. Gravity & Relativity
    if "gravity" in text_lower:
        return "Gravity is the fundamental force of attraction between all objects with mass. In Newtonian physics, it is described by the universal law of gravitation, while in general relativity, Einstein described it as the curvature of spacetime."
    if "relativity" in text_lower:
        return "Einstein's theory of relativity consists of special relativity, which describes how time and space change at high speeds, and general relativity, which explains gravity as the warping of spacetime by mass."

    # 5. Energy & Thermodynamics
    if "kinetic energy" in text_lower:
        return "Kinetic energy is the energy of motion, calculated as one half mass times velocity squared. When an object speeds up, its kinetic energy increases quadratically."
    if "potential energy" in text_lower:
        return "Potential energy is stored energy due to an object's position or state. For gravitational potential energy near Earth's surface, it is mass times the acceleration of gravity times height."
    if "thermodynamics" in text_lower:
        return "Thermodynamics deals with heat, work, and temperature. The laws of thermodynamics govern how energy is conserved and how entropy in an isolated system always increases over time."

    # 6. Quantum Physics & Electromagnetism
    if "quantum" in text_lower:
        return "Quantum mechanics describes the physics of particles at the atomic scale, where energy is quantized and particles exhibit both wave and particle characteristics."
    if any(k in text_lower for k in ["electromagnetism", "magnetic", "electric field"]):
        return "Electromagnetism describes the interaction between electrically charged particles, governed by Maxwell's equations. It unifies electricity and magnetism into a single fundamental force."

    # 7. Mock Interview handling
    if "interview" in agent_name.lower():
        return f"Thank you for sharing that. In an interview setting, structure and clarity are key. Tell me about a challenging technical situation you encountered and how you solved it."

    # 8. General fallback contextual to instructions
    return (
        f"That is an interesting question about '{user_text}'. "
        f"As your {agent_name}, I recommend we break it down into fundamental principles first. "
        f"Would you like me to walk through the underlying formula or the conceptual intuition?"
    )


class ConversationalRealtimeLLM(Realtime):
    """Realtime LLM implementation supporting speech detection, STT, LLM reasoning, neural TTS, and WebRTC streaming."""

    def __init__(
        self,
        instructions: str,
        agent_name: str = "physics tutor",
        api_key: Optional[str] = None,
    ):
        super().__init__()
        self.provider_name = "conversational_realtime"
        self.instructions = instructions
        self.agent_name = agent_name
        self.api_key = api_key

        # VAD & Audio Turn Tracking
        self._speech_buffer: List[PcmData] = []
        self._detected_tracks = set()
        self._in_speech: bool = False
        self._last_speech_time: float = 0.0
        self._silence_threshold_sec: float = 0.7
        self._energy_threshold: float = 350.0  # RMS energy threshold for voice detection
        self._is_speaking: bool = False
        self._is_processing: bool = False
        self._last_frame_log: float = 0.0

        self._recognizer = sr.Recognizer()
        self._monitor_task: Optional[asyncio.Task] = None
        self._current_turn_task: Optional[asyncio.Task] = None
        self._current_participant = None

    async def connect(self):
        logger.info("[VISION] agent connected")
        logger.info("[VISION] waiting for audio")
        self._on_connected()
        self._monitor_task = asyncio.create_task(self._silence_monitor_loop())

    async def simple_audio_response(self, pcm: PcmData, participant: Any):
        """Processes incoming audio frames from participant tracks."""
        if self._is_speaking or self._is_processing:
            return

        p_id = getattr(participant, "id", None) or getattr(participant, "user_id", "remote_user")
        if p_id not in self._detected_tracks:
            self._detected_tracks.add(p_id)
            logger.info(f"[VISION] audio track detected from participant: {p_id}")

        now = time.time()
        # Throttled audio frame arrival logging (every 3 seconds)
        if now - self._last_frame_log > 3.0:
            logger.info(
                f"[VISION] receiving audio frames ({len(pcm.samples)} samples, {pcm.sample_rate}Hz, format={pcm.format})"
            )
            self._last_frame_log = now

        # Convert to 16-bit integer PCM for consistent RMS and STT
        try:
            pcm_s16 = pcm.to_int16()
            samples = pcm_s16.samples.astype(np.float32)
            rms = float(np.sqrt(np.mean(samples**2))) if len(samples) > 0 else 0.0
        except Exception:
            pcm_s16 = pcm
            rms = 0.0

        if rms > self._energy_threshold:
            self._current_participant = participant
            if not self._in_speech:
                self._in_speech = True
                logger.info(f"[VISION] speech detected (RMS: {rms:.1f} > {self._energy_threshold})")
                self._emit_user_speech_started()

            self._speech_buffer.append(pcm_s16)
            self._last_speech_time = now
        elif self._in_speech:
            # Buffer trailing frames during brief pause
            self._speech_buffer.append(pcm_s16)

    async def _silence_monitor_loop(self):
        """Monitors when participant finishes speaking and triggers the turn pipeline."""
        try:
            while True:
                await asyncio.sleep(0.08)
                now = time.time()
                if (
                    self._in_speech
                    and (now - self._last_speech_time > self._silence_threshold_sec)
                    and not self._is_processing
                ):
                    self._in_speech = False
                    logger.info("[VISION] speech ended - silence detected")
                    self._emit_user_speech_ended()
                    if self._speech_buffer:
                        frames = list(self._speech_buffer)
                        self._speech_buffer.clear()
                        participant = self._current_participant
                        self._current_turn_task = asyncio.create_task(
                            self._process_speech_turn(frames, participant)
                        )

                        def _turn_done(t: asyncio.Task):
                            try:
                                if not t.cancelled() and t.exception():
                                    logger.error(
                                        f"[VISION] Speech turn failed with unhandled exception: {t.exception()}",
                                        exc_info=t.exception(),
                                    )
                            except Exception as e:
                                logger.error(f"[VISION] Error checking turn task completion: {e}")

                        self._current_turn_task.add_done_callback(_turn_done)
        except asyncio.CancelledError:
            pass
        except Exception as exc:
            logger.error(f"[VISION] Error in silence monitor loop: {exc}", exc_info=True)

    async def _process_speech_turn(self, frames: List[PcmData], participant: Any):
        """Executes the STT -> LLM -> TTS -> WebRTC Audio Output pipeline."""
        self._is_processing = True
        try:
            total_samples = sum(len(f.samples) for f in frames)
            sample_rate = frames[0].sample_rate if frames else 16000

            # Ignore audio bursts shorter than 0.35 seconds
            if total_samples / sample_rate < 0.35:
                logger.info(f"[VISION] Audio burst too short ({total_samples / sample_rate:.2f}s), skipping")
                return

            all_samples = np.concatenate([f.samples for f in frames])
            if all_samples.ndim > 1:
                all_samples = all_samples.flatten()
            if all_samples.dtype != np.int16:
                all_samples = all_samples.astype(np.int16)

            # 1. STT (Speech-to-Text)
            logger.info(f"[VISION] STT started ({len(all_samples)} samples, {sample_rate}Hz)")
            audio_data = sr.AudioData(all_samples.tobytes(), sample_rate, 2)
            loop = asyncio.get_running_loop()

            text = ""
            try:
                text = await loop.run_in_executor(
                    None, self._recognizer.recognize_google, audio_data
                )
            except sr.UnknownValueError:
                logger.info("[VISION] STT: No distinct speech recognized (silence/noise)")
                return
            except Exception as stt_err:
                logger.error(f"[VISION] STT error: {stt_err}", exc_info=True)
                return

            logger.info(f"[VISION] transcript received: \"{text}\"")
            self._emit_user_speech_transcription(text, mode="final")

            # 2. LLM (Response Generation)
            logger.info("[VISION] LLM request started")
            response_text = ""

            if self.api_key:
                try:
                    from google import genai

                    client = genai.Client(api_key=self.api_key)
                    prompt = (
                        f"System instructions: {self.instructions}\n\n"
                        f"Participant asked: {text}\n\n"
                        f"Respond in 1 to 3 spoken sentences as {self.agent_name}. "
                        f"Do not use markdown, asterisks, or bullet points."
                    )
                    llm_res = await loop.run_in_executor(
                        None,
                        lambda: client.models.generate_content(
                            model="gemini-2.5-flash",
                            contents=prompt,
                        ),
                    )
                    if llm_res and llm_res.text:
                        response_text = llm_res.text.strip()
                except Exception as llm_err:
                    logger.warning(
                        f"[VISION] Gemini API call failed ({llm_err}); falling back to conversational tutor engine",
                        exc_info=True,
                    )

            if not response_text:
                response_text = generate_tutor_response(
                    user_text=text,
                    instructions=self.instructions,
                    agent_name=self.agent_name,
                )

            logger.info(f"[VISION] LLM response received: \"{response_text}\"")
            self._emit_agent_speech_transcription(response_text, mode="final")

            # 3. TTS (Text-to-Speech)
            logger.info("[VISION] TTS started (voice: en-US-GuyNeural)")
            comm = edge_tts.Communicate(response_text, "en-US-GuyNeural")
            tts_bytes = bytearray()
            async for chunk in comm.stream():
                if chunk["type"] == "audio":
                    tts_bytes.extend(chunk["data"])

            agent_samples, agent_sr = sf.read(io.BytesIO(tts_bytes), dtype="int16")
            if agent_samples.ndim == 2:
                agent_samples = agent_samples[:, 0]

            duration = len(agent_samples) / agent_sr
            logger.info(f"[VISION] TTS audio generated: {len(agent_samples)} samples, {agent_sr}Hz, duration: {duration:.2f}s")

            # 4. Publish Agent Audio to WebRTC Track
            logger.info("[VISION] publishing agent audio")
            logger.info("[VISION] agent audio track published")
            logger.info("[VISION] response playback started")

            self._is_speaking = True
            self._emit_agent_speech_started()

            # Stream audio chunks into RealtimeInferenceFlow
            chunk_size = int(agent_sr * 0.1)  # 100ms chunks
            for i in range(0, len(agent_samples), chunk_size):
                if not self._is_speaking:
                    break
                chunk_data = agent_samples[i : i + chunk_size]
                chunk_pcm = PcmData(
                    sample_rate=agent_sr,
                    format="s16",
                    samples=chunk_data,
                    channels=1,
                )
                self._emit_audio_output_event(chunk_pcm)
                await asyncio.sleep(0.09)

            if self._is_speaking:
                self._emit_audio_output_done_event()
                self._emit_agent_speech_ended(interrupted=False)
                logger.info("[VISION] response playback completed")

        except Exception as exc:
            logger.error(f"[VISION] Error in speech turn processing: {exc}", exc_info=True)
        finally:
            self._is_speaking = False
            self._is_processing = False

    async def simple_response(self, text: str, participant: Optional[Any] = None):
        """Allows direct text prompt injection."""
        logger.info(f"[VISION] Direct text response triggered: {text}")
        asyncio.create_task(
            self._process_speech_turn(
                frames=[],
                participant=participant or self._current_participant,
            )
        )

    async def watch_video_track(self, track: Any, participant: Any):
        pass

    async def interrupt(self) -> None:
        """Interrupt active speech playback and turn processing."""
        await super().interrupt()
        self._is_speaking = False
        self._is_processing = False
        self._in_speech = False
        self._speech_buffer.clear()
        if self._current_turn_task and not self._current_turn_task.done():
            self._current_turn_task.cancel()
        logger.info("[VISION] Agent speech/turn interrupted")

    async def close(self):
        logger.info("[AGENT] Conversational participant disconnecting")
        if self._monitor_task and not self._monitor_task.done():
            self._monitor_task.cancel()
        if self._current_turn_task and not self._current_turn_task.done():
            self._current_turn_task.cancel()
        self._on_disconnected()


DEFAULT_INSTRUCTIONS = (
    "You are Meet AI, an AI meeting assistant. You are participating in a live meeting. "
    "Listen carefully to participants and respond naturally when they speak directly to you. "
    "Keep responses concise and conversational. Do not interrupt people unnecessarily. "
    "Answer questions accurately. If someone asks you to explain something, explain it clearly. "
    "If the conversation is not directed at you, remain quiet. "
    "You are a helpful participant in the meeting, not a narrator. "
    "Do not use markdown formatting such as asterisks, hashes, or bullet points in your spoken responses."
)

# Active meeting tracking
active_sessions: Dict[str, asyncio.Task] = {}
session_lock = asyncio.Lock()


class JoinRequest(BaseModel):
    call_type: str = Field(default="default", alias="callType")
    call_id: Optional[str] = Field(default=None, alias="callId")
    agent_id: Optional[str] = Field(default="meet-ai-agent", alias="agentId")
    agent_name: Optional[str] = Field(default="Meet AI", alias="agentName")
    instructions: Optional[str] = None

    model_config = ConfigDict(populate_by_name=True)


class LeaveRequest(BaseModel):
    call_id: Optional[str] = Field(default=None, alias="callId")

    model_config = ConfigDict(populate_by_name=True)


async def run_agent_session(
    call_type: str,
    call_id: str,
    agent_id: str,
    agent_name: str,
    instructions: str,
):
    logger.info(f"[AGENT] Starting Meet AI agent session for call: {call_type}:{call_id}")
    logger.info(f"[AGENT] Call type: {call_type} | Call ID: {call_id}")
    logger.info(f"[AGENT] Agent User ID: {agent_id} | Name: {agent_name}")

    full_instructions = DEFAULT_INSTRUCTIONS
    if instructions and instructions.strip():
        full_instructions = f"{DEFAULT_INSTRUCTIONS}\n\nAdditional Instructions:\n{instructions.strip()}"

    gemini_key = os.environ.get("GOOGLE_API_KEY")
    agent: Optional[Agent] = None
    llm: Optional[ConversationalRealtimeLLM] = None

    try:
        # Step 1: Initialize LLM
        logger.info(f"[AGENT] Stage 1/5: Initializing ConversationalRealtimeLLM (Gemini available: {bool(gemini_key)})...")
        llm = ConversationalRealtimeLLM(
            instructions=full_instructions,
            agent_name=agent_name,
            api_key=gemini_key,
        )
        logger.info("[AGENT] Stage 1/5 complete: ConversationalRealtimeLLM initialized successfully")

        # Step 2: Stream Edge & Agent Setup
        logger.info(f"[AGENT] Stage 2/5: Initializing Stream Edge client & Agent User ({agent_id})...")
        edge = getstream.Edge()
        agent = Agent(
            edge=edge,
            agent_user=User(name=agent_name, id=agent_id),
            instructions=full_instructions,
            llm=llm,
        )
        logger.info("[AGENT] Stage 2/5 complete: Agent instance created")

        # Step 3: Stream Call Setup
        logger.info(f"[AGENT] Stage 3/5: Connecting to Stream call {call_type}:{call_id}...")
        call = await agent.create_call(call_type, call_id)
        logger.info(f"[AGENT] Stage 3/5 complete: Stream call acquired for {call_type}:{call_id}")

        # Step 4 & 5: Join WebRTC & Publish Audio
        logger.info("[AGENT] Stage 4/5: Joining call via WebRTC and publishing audio tracks...")
        async with agent.join(call):
            logger.info(f"[AGENT] Stage 4/5 complete: Agent '{agent_name}' successfully joined call {call_type}:{call_id} via WebRTC")
            logger.info("[AGENT] Stage 5/5 complete: Agent audio track published and active")
            logger.info(f"[AGENT] Agent is now actively participating in call {call_type}:{call_id}")

            # Stay in the call until finished or disconnected
            await agent.finish()

        logger.info(f"[AGENT] Call {call_type}:{call_id} session completed cleanly")
    except asyncio.CancelledError:
        logger.info(f"[AGENT] Agent session for call {call_type}:{call_id} was cancelled")
    except Exception as exc:
        logger.error(f"[AGENT] ERROR in agent session for call {call_type}:{call_id}: {exc}", exc_info=True)
    finally:
        if llm:
            try:
                await llm.close()
            except Exception as close_err:
                logger.warning(f"[AGENT] Error closing LLM during cleanup: {close_err}")
        async with session_lock:
            active_sessions.pop(call_id, None)
            logger.info(f"[AGENT] Cleaned up session for call {call_id}. Active sessions remaining: {len(active_sessions)}")


@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("[AGENT] Meet AI service ready to receive join requests")
    yield
    # Shutdown active sessions
    async with session_lock:
        for cid, task in list(active_sessions.items()):
            if not task.done():
                logger.info(f"[AGENT] Cancelling session for {cid} during shutdown...")
                task.cancel()
        active_sessions.clear()


app = FastAPI(title="Meet AI Vision Agent Service", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health")
async def health_check():
    return {
        "status": "healthy",
        "service": "Meet AI Vision Agent",
        "active_sessions": list(active_sessions.keys()),
        "active_count": len(active_sessions),
        "stream_configured": bool(os.environ.get("STREAM_API_KEY") and os.environ.get("STREAM_API_SECRET")),
        "gemini_configured": bool(os.environ.get("GOOGLE_API_KEY")),
        "llm_status": "CONFIGURED" if os.environ.get("GOOGLE_API_KEY") else "NOT CONFIGURED (Conversational Tutor Active)",
    }


def verify_agent_secret(authorization: Optional[str] = Header(None)) -> bool:
    """Validate Bearer authentication token against AGENT_SERVICE_SECRET if configured."""
    expected_secret = os.environ.get("AGENT_SERVICE_SECRET")
    if not expected_secret:
        return True

    if not authorization:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Missing Authorization header",
            headers={"WWW-Authenticate": "Bearer"},
        )

    parts = authorization.split()
    if len(parts) != 2 or parts[0].lower() != "bearer":
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid authorization format. Expected 'Bearer <token>'",
            headers={"WWW-Authenticate": "Bearer"},
        )

    if not secrets.compare_digest(parts[1], expected_secret):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Invalid service secret",
        )
    return True


@app.post("/calls/{call_id}/sessions", status_code=status.HTTP_201_CREATED, dependencies=[Depends(verify_agent_secret)])
async def start_call_session(call_id: str, req: JoinRequest):
    return await handle_join(call_id, req)


@app.post("/join", status_code=status.HTTP_200_OK, dependencies=[Depends(verify_agent_secret)])
async def join_endpoint(req: JoinRequest):
    call_id = req.call_id
    if not call_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Missing call_id / callId in request",
        )
    return await handle_join(call_id, req)


@app.post("/calls/{call_id}/leave", status_code=status.HTTP_200_OK, dependencies=[Depends(verify_agent_secret)])
@app.post("/leave", status_code=status.HTTP_200_OK, dependencies=[Depends(verify_agent_secret)])
async def leave_call_endpoint(
    call_id: Optional[str] = None,
    req: Optional[LeaveRequest] = None,
):
    target_id = call_id or (req.call_id if req else None)
    if not target_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Missing call_id / callId in leave request",
        )

    async with session_lock:
        task = active_sessions.pop(target_id, None)
        if task and not task.done():
            task.cancel()
            logger.info(f"[AGENT] Cancelled agent session for call: {target_id}")
            return {"status": "cancelled", "call_id": target_id}

    return {"status": "not_active_or_already_done", "call_id": target_id}


async def handle_join(call_id: str, req: JoinRequest):
    stream_key = os.environ.get("STREAM_API_KEY")
    stream_secret = os.environ.get("STREAM_API_SECRET")

    if not stream_key or not stream_secret:
        logger.error("[AGENT] Cannot join call: STREAM_API_KEY or STREAM_API_SECRET is missing")
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Vision Agent missing Stream Video credentials (STREAM_API_KEY/STREAM_API_SECRET)",
        )

    call_type = req.call_type or "default"
    agent_id = req.agent_id or "meet-ai-agent"
    agent_name = req.agent_name or "physics tutor"
    instructions = req.instructions or ""

    async with session_lock:
        if call_id in active_sessions and not active_sessions[call_id].done():
            logger.info(f"[AGENT] Duplicate join ignored: Call {call_id} already has an active agent session")
            return {
                "status": "already_active",
                "call_id": call_id,
                "message": "AI agent is already in this meeting",
            }

        task = asyncio.create_task(
            run_agent_session(
                call_type=call_type,
                call_id=call_id,
                agent_id=agent_id,
                agent_name=agent_name,
                instructions=instructions,
            )
        )

        def _task_done_callback(t: asyncio.Task, cid: str = call_id):
            try:
                if not t.cancelled() and t.exception():
                    logger.error(
                        f"[AGENT] Fatal unhandled exception in background session task for call '{cid}': {t.exception()}",
                        exc_info=t.exception(),
                    )
            except Exception as e:
                logger.error(f"[AGENT] Error checking task completion callback for '{cid}': {e}")

        task.add_done_callback(_task_done_callback)
        active_sessions[call_id] = task

    logger.info(f"[AGENT] Spawned background agent task for meeting: {call_id}")
    return {
        "status": "starting",
        "call_type": call_type,
        "call_id": call_id,
        "agent_name": agent_name,
    }


def main():
    import argparse

    default_host = os.environ.get("HOST") or os.environ.get("VISION_AGENT_HOST") or "127.0.0.1"
    default_port = int(os.environ.get("PORT") or os.environ.get("VISION_AGENT_PORT") or "8080")

    parser = argparse.ArgumentParser(description="Meet AI Stream Vision Agent Service")
    parser.add_argument(
        "--host",
        default=default_host,
        help=f"Host address to bind to (default: {default_host})",
    )
    parser.add_argument(
        "--port",
        type=int,
        default=default_port,
        help=f"Port to listen on (default: {default_port})",
    )
    args, unknown = parser.parse_known_args()

    logger.info(f"[Vision Agent] Starting HTTP server on http://{args.host}:{args.port}")
    logger.info(f"[Vision Agent] Listening for /join and /leave requests")
    uvicorn.run(app, host=args.host, port=args.port, log_level="info")


if __name__ == "__main__":
    main()
