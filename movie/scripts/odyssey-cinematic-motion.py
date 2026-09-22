"""Generate the cinematic finale through the official public image-to-video demo."""
import json
import shutil
import time
from pathlib import Path
from gradio_client import Client, handle_file

ROOT = Path(__file__).resolve().parents[1]
WORK = ROOT / 'tmp/odyssey/cinematic'
WORK.mkdir(parents=True, exist_ok=True)
PROMPT = ('One continuous live-action cinematic shot. A weathered bearded Greek warrior '
    'in bronze helmet and armor grips a small silver Mac mini computer on a stone altar. '
    'He strains, his shoulders and arms trembling, then slowly rises from his kneeling '
    'position, lifting the computer off the stone and bringing it to his chest with both '
    'hands. The computer stays a compact silver square desktop. He looks solemnly toward '
    'the horizon, exhausted and triumphant. The two soldiers watch behind him. Wind moves '
    'cloaks and the sea glistens. Camera slowly pulls back and tilts upward to keep his '
    'face, helmet, arms, and computer in frame. Realistic body motion and film lighting. '
    'Preserve the reference character identity and costume. No speech, no subtitles, no cuts.')
request = {'provider':'Lightricks LTX-2.3 official public demo',
    'reference':'assets/odyssey/cinematic-hero-wide.png',
    'upload':'tmp/odyssey/cinematic/reference-upload.jpg', 'prompt':PROMPT,
    'duration':8,'width':1280,'height':576,'seed':92122}
try:
    client = Client('https://lightricks-ltx-2-3.hf.space/', verbose=False,
        download_files=str(WORK), analytics_enabled=False, httpx_kwargs={'timeout':120})
    job = client.submit(handle_file(str(ROOT/request['upload'])), PROMPT,
        8, False, 92122, False, 576, 1280, api_name='/generate_video')
    print('Submitted cinematic finale.', flush=True)
    started = time.monotonic()
    previous = None
    while not job.done():
        status = str(job.status().code)
        if status != previous:
            print(status, flush=True)
            previous = status
        if time.monotonic()-started > 900:
            job.cancel()
            raise RuntimeError('Generation time limit')
        time.sleep(10)
    result = job.result()
    file = result[0]
    if isinstance(file,dict): file = file.get('video',file.get('path'))
    if isinstance(file,dict): file = file['path']
    shutil.copy2(file, WORK/'lift-cloud.mp4')
    request.update(status='generated',output='tmp/odyssey/cinematic/lift-cloud.mp4')
    print('Generated:', WORK/'lift-cloud.mp4', flush=True)
except Exception as error:
    request.update(status='failed',error=str(error))
    print('Generation unavailable:', error, flush=True)
finally:
    (WORK/'cloud-request.json').write_text(json.dumps(request,ensure_ascii=False,indent=2))
