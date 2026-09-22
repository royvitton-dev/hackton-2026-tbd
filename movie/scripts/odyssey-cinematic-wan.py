"""Use the official Wan public demo through its documented UI endpoints."""
import argparse
import json
import shutil
import time
from pathlib import Path
from gradio_client import Client, handle_file

ROOT=Path(__file__).resolve().parents[1]
WORK=ROOT/'tmp/odyssey/cinematic'
parser=argparse.ArgumentParser()
parser.add_argument('--shot',choices=['lift','victory'],default='lift')
args=parser.parse_args()
if args.shot=='lift':
    reference=ROOT/'assets/odyssey/cinematic-hero-wide.png'
    prompt=('One continuous photoreal cinematic shot. The bearded Greek warrior in the '
        'bronze helmet and worn armor grips the small silver Mac mini desktop computer '
        'with both hands. He strains visibly, lifts the computer off the stone altar, '
        'and slowly rises from one knee to stand, bringing the computer to his chest. '
        'The small silver square computer retains its rigid shape and size. He looks '
        'exhausted, solemn and determined. His two companions watch behind him. Wind '
        'moves their cloaks. Sea waves shimmer in the dawn. Camera gently dollies back '
        'and tilts up to keep his entire helmet, hands, and computer visible as he rises. '
        'Natural human body motion, subtle breathing, preserve the exact faces and '
        'costumes. No talking, no smile, no text, no scene cuts.')
else:
    reference=WORK/'wan-lift-last-frame.png'
    prompt=('One continuous photoreal cinematic shot, continuing the reference image. '
        'The same bearded Greek warrior in the bronze helmet stands holding the small '
        'silver Mac mini desktop computer securely at his chest with both hands. '
        'Breathing heavily after the effort, his shoulders settle and he slowly raises '
        'his gaze toward the dawn horizon. Solemn quiet triumph. The two soldiers '
        'remain behind him, their olive cloaks moving in the breeze. The sea shimmers. '
        'Camera slowly moves closer while keeping the entire helmet, hands and silver '
        'computer visible. Preserve the exact faces, costumes and computer shape. '
        'Subtle natural human motion. No talking, no smile, no text, no scene cuts.')

record=WORK/f'wan-{args.shot}-request.json'
request={'provider':'Wan2.1 official public demo / wanx2.1-i2v-plus',
    'endpoint':'https://huggingface.co/spaces/Wan-AI/Wan2.1',
    'shot':args.shot,'reference':str(reference.relative_to(ROOT)),
    'prompt':prompt,'seed':92122,'status':'submitting'}
def save():record.write_text(json.dumps(request,ensure_ascii=False,indent=2)+'\n')

downloads=WORK/'wan-results'
downloads.mkdir(exist_ok=True)
def find_video(value):
    if isinstance(value,dict):
        for v in value.values():
            found=find_video(v)
            if found:return found
    elif isinstance(value,(list,tuple)):
        for v in value:
            found=find_video(v)
            if found:return found
    elif isinstance(value,str) and value.endswith('.mp4'):
        candidate=Path(value)
        if candidate.is_file() and candidate.resolve().is_relative_to(downloads.resolve()):
            return candidate
    return None

try:
    save()
    client=Client('Wan-AI/Wan2.1',verbose=False,download_files=str(downloads),
        analytics_enabled=False,httpx_kwargs={'timeout':120})
    client.predict(api_name='/switch_i2v_tab')
    submitted=client.predict(prompt,handle_file(str(reference)),False,92122,
        api_name='/i2v_generation_async')
    if not any(isinstance(v,(int,float)) for v in submitted):
        raise RuntimeError('The public demo did not accept the generation request')
    request.update(status='generating',submittedAt=time.strftime('%Y-%m-%dT%H:%M:%S%z'))
    save()
    print('Wan accepted the image-to-video request.',flush=True)
    started=time.monotonic()
    while time.monotonic()-started<1200:
        time.sleep(30)
        result=client.predict(api_name='/status_refresh_1')
        video=find_video(result)
        print('Generation status refreshed; elapsed seconds:',round(time.monotonic()-started),
            'video ready:',video is not None,flush=True)
        if video:
            target=WORK/f'wan-{args.shot}-raw.mp4'
            shutil.copy2(video,target)
            request.update(status='generated',output=str(target.relative_to(ROOT)))
            save()
            print('Saved:',target.name,flush=True)
            break
    else:raise TimeoutError('The public demo did not finish within 20 minutes')
except Exception as error:
    request.update(status='failed',error=str(error))
    save()
    raise
