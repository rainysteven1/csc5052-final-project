"""ASR backend implementations."""

from services.asr.src.backends.onnx_whisper import OnnxWhisperBackendError, transcribe_with_onnx_whisper

__all__ = ["OnnxWhisperBackendError", "transcribe_with_onnx_whisper"]
