"""Resume the requested finale automatically when verified model files are ready."""
import fcntl
import json
import subprocess
import time
from pathlib import Path

ROOT=Path(__file__).resolve().parents[1]
WORK=ROOT/'tmp/odyssey/cinematic'
WORK.mkdir(parents=True,exist_ok=True)
lock=(WORK/'job.lock').open('w')
fcntl.flock(lock,fcntl.LOCK_EX|fcntl.LOCK_NB)
python=ROOT/'tmp/odyssey/model-venv/bin/python'
required=[ROOT/'tmp/odyssey/ltx-model'/f for f in [
    'connector.safetensors','transformer-distilled-1.1.safetensors',
    'vae_encoder.safetensors','vae_decoder.safetensors','spatial_upscaler_x2_v1_1.safetensors']]
required += [ROOT/'tmp/odyssey/gemma-model'/f for f in [
    'model-00001-of-00002.safetensors','model-00002-of-00002.safetensors','tokenizer.json']]
status_file=WORK/'job-status.json'
def status(stage,**extra):
    value={'stage':stage,'updatedAt':time.strftime('%Y-%m-%dT%H:%M:%S%z'),**extra}
    status_file.write_text(json.dumps(value,ensure_ascii=False,indent=2)+'\n')

try:
    print('Waiting for verified model components.',flush=True)
    prompt_files=[p for p in required if p.name in {
        'connector.safetensors','model-00001-of-00002.safetensors',
        'model-00002-of-00002.safetensors','tokenizer.json'}]
    prompts_prepared=False
    while not all(p.is_file() for p in required):
        status('downloading_models',ready=sum(p.is_file() for p in required),required=len(required),
               pending=[p.name for p in required if not p.is_file()])
        if not prompts_prepared and all(p.is_file() for p in prompt_files):
            status('preparing_motion_prompts')
            for shot in ['lift','victory']:
                with (WORK/f'{shot}-encoding.log').open('w') as log:
                    subprocess.run([str(python),str(ROOT/'scripts/odyssey-cinematic-local.py'),
                        '--shot',shot,'--encode-only'],stdout=log,stderr=subprocess.STDOUT,check=True)
            prompts_prepared=True
            print('Motion direction embeddings are cached.',flush=True)
        time.sleep(30)
    print('Model files ready. Generating the lift.',flush=True)
    for shot in ['lift','victory']:
        output=WORK/f'{shot}-raw.mp4'
        if not output.exists():
            status('generating_video',shot=shot)
            with (WORK/f'{shot}-generation.log').open('w') as log:
                subprocess.run([str(python),str(ROOT/'scripts/odyssey-cinematic-local.py'),'--shot',shot],
                    stdout=log,stderr=subprocess.STDOUT,check=True)
        subprocess.run(['ffmpeg','-hide_banner','-loglevel','error','-i',str(output),'-f','null','-'],check=True)
        if shot=='lift':
            # Seeking less than one frame from EOF can land after the last
            # timestamp. Select the decoded final frame explicitly instead.
            probe=json.loads(subprocess.check_output(['ffprobe','-v','error',
                '-select_streams','v:0','-count_frames','-show_entries',
                'stream=nb_read_frames','-of','json',str(output)],text=True))
            last=int(probe['streams'][0]['nb_read_frames'])-1
            reference=WORK/'lift-last-frame.png'
            subprocess.run(['ffmpeg','-hide_banner','-loglevel','error','-y',
                '-i',str(output),'-vf',f'select=eq(n\\,{last})',
                '-frames:v','1',str(reference)],check=True)
            if not reference.is_file():
                raise RuntimeError('The final frame needed for continuity was not extracted')
        print('Generated:',shot,flush=True)
    status('preparing_frames')
    subprocess.run(['node',str(ROOT/'scripts/odyssey-cinematic-frames.mjs')],check=True)
    status('ready_for_visual_review',clips=['lift-raw.mp4','victory-raw.mp4'])
    print('Both generated clips are ready for visual review before the final edit.',flush=True)
except Exception as error:
    status('failed',error=str(error))
    raise
