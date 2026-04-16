"""
Called by the Express server to transcribe audio/video files via pplx SDK.
Usage: python3 transcribe_helper.py <filepath> <mimetype>
Outputs the transcript text to stdout.
"""
import sys
import asyncio

async def main():
    if len(sys.argv) < 3:
        print("", end="")
        return

    filepath = sys.argv[1]
    media_type = sys.argv[2]

    # Map video and M4A types to audio for transcription
    type_map = {
        "video/mp4": "audio/mp4",
        "video/webm": "audio/webm",
        "video/mpeg": "audio/mpeg",
        "video/quicktime": "audio/mp4",
        "audio/x-m4a": "audio/mp4",
        "audio/m4a": "audio/mp4",
    }
    media_type = type_map.get(media_type, media_type)
    if not media_type.startswith("audio/"):
        media_type = "audio/mpeg"

    with open(filepath, "rb") as f:
        audio_bytes = f.read()

    sys.path.insert(0, "/home/user/workspace/revenue-recap-app/server")
    from llm_helpers.transcribe_audio import transcribe_audio
    result = await transcribe_audio(audio_bytes, media_type=media_type, diarize=False)
    print(result.get("text", ""), end="")

asyncio.run(main())
