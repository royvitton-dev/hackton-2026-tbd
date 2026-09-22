"""Generate an actual continuous Mac mini finale through the public LTX demo."""
import json
import os
import shutil
import time
from pathlib import Path
from gradio_client import Client, handle_file

ROOT = Path(__file__).resolve().parents[1]
WORK = ROOT / "tmp/odyssey/motion"
WORK.mkdir(parents=True, exist_ok=True)
PROMPT = """One continuous cinematic live-action shot, no cuts. Three exhausted Korean men wearing dark rain-soaked ancient traveling cloaks on stone temple steps above a stormy sea at golden sunrise. The central kneeling man firmly grips the small silver square desktop computer resting on the stone pedestal. With visible effort he slowly lifts the small computer off the pedestal, struggles upward from his knees, straightens his body, and brings the computer to his upper chest. His two companions gently support his upper arms and shoulders as he rises. Their arms, hands, shoulders and bodies move naturally with believable weight and trembling effort. They are serious and quietly relieved, never smiling, never speaking. The central man's gaze slowly lifts toward the horizon. Wind moves their wet cloaks and hair, rain falls and waves roll behind them. Camera gently dollies backwards and tilts up to keep all three faces and the small silver computer visible throughout the movement. Preserve the reference faces and identities, the computer's compact rounded square silver shape and black top logo. Photorealistic movie cinematography, realistic continuous motion, no morphing, no extra fingers, no change of computer, no text or captions."""
request = {
    "provider": "Lightricks public LTX-2.3 demo",
    "endpoint": "https://lightricks-ltx-2-3.hf.space/",
    "reference": "assets/odyssey/macmini-struggle.png",
    "prompt": PROMPT,
    "duration": 8,
    "width": 1280,
    "height": 720,
    "seed": 92122,
    "status": "preparing",
}
(WORK / "request.json").write_text(json.dumps(request, ensure_ascii=False, indent=2))
try:
    client = Client(request["endpoint"], token=os.environ.get("HF_TOKEN"), verbose=False, download_files=WORK, analytics_enabled=False)
    print("Submitting 8-second image-to-video shot to Lightricks LTX-2.3.", flush=True)
    job = client.submit(
        handle_file(str(ROOT / request["reference"])), PROMPT,
        8, False, request["seed"], False, 720, 1280,
        api_name="/generate_video",
    )
    started = time.monotonic()
    previous = None
    while not job.done():
        status = job.status()
        state = str(status.code)
        if state != previous:
            print(f"Generation: {state}; queue rank: {status.rank}", flush=True)
            previous = state
        if time.monotonic() - started > 900:
            job.cancel()
            raise TimeoutError("Video generation exceeded the 15-minute limit")
        time.sleep(10)
    result = job.result()
    print("Generation result:", result, flush=True)
    video = result[0] if isinstance(result, (list, tuple)) else result
    if isinstance(video, dict):
        video = video.get("video", video.get("path"))
    if isinstance(video, dict):
        video = video["path"]
    source = Path(video)
    if not source.is_file():
        raise RuntimeError(f"No generated video file: {video}")
    target = ROOT / "assets/odyssey/macmini-motion.mp4"
    shutil.copy2(source, target)
    request.update(status="generated", output="assets/odyssey/macmini-motion.mp4")
    (ROOT / "assets/odyssey/motion-generation.json").write_text(json.dumps(request, ensure_ascii=False, indent=2))
    print("Saved:", target, flush=True)
except Exception as error:
    request.update(status="failed", error=str(error))
    (WORK / "request.json").write_text(json.dumps(request, ensure_ascii=False, indent=2))
    print("Video generation unavailable:", error, flush=True)
    raise
