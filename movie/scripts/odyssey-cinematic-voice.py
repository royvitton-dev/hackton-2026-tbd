"""Design an original Korean bass-baritone, then keep that timbre across lines."""
import argparse
import gc
import json
import os
import subprocess
import shutil
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
WORK = ROOT / 'tmp/odyssey/cinematic-voice'
OUT = ROOT / 'assets/odyssey/voices-cinematic'
WORK.mkdir(parents=True, exist_ok=True)
OUT.mkdir(parents=True, exist_ok=True)
os.environ['HF_HUB_CACHE'] = str(ROOT / 'tmp/odyssey/model-cache')
os.environ['HF_HUB_DISABLE_TELEMETRY'] = '1'
import mlx.core as mx
import numpy as np
from scipy.io.wavfile import write as write_wav
from mlx_audio.tts.utils import load_model

mx.set_cache_limit(256 * 1024**2)
mx.set_memory_limit(8 * 1024**3)
parser = argparse.ArgumentParser()
parser.add_argument('--design-only', action='store_true')
args = parser.parse_args()

DESCRIPTION = 'A deep resonant male Korean movie trailer narrator. Slow, solemn and powerful bass voice.'
REFERENCE_TEXT = '맥미니를 얻기 위해서였다.'
reference = WORK / 'baritone-reference.wav'

def save_results(results, target):
    chunks = []
    rate = 24000
    for result in results:
        mx.eval(result.audio)
        chunks.append(np.array(result.audio).reshape(-1))
        rate = result.sample_rate
    signal = np.concatenate(chunks).astype(np.float32)
    if len(signal) < rate // 4:
        raise RuntimeError('Empty synthesized speech')
    # Trim only leading/trailing silence, keeping natural pauses inside the line.
    window = max(1, rate // 100)
    energy = np.convolve(np.abs(signal), np.ones(window)/window, mode='same')
    active = np.where(energy > max(.001, float(energy.max())*.025))[0]
    if len(active):
        signal = signal[max(0, active[0]-int(.08*rate)):min(len(signal), active[-1]+int(.15*rate))]
    write_wav(target, rate, signal)
    return rate, signal

def pitch_summary(signal, rate):
    values=[]
    for start in range(0, len(signal)-int(.055*rate), int(.03*rate)):
        part = signal[start:start+int(.055*rate)].astype(np.float64)
        if np.sqrt(np.mean(part*part)) < .015: continue
        part = (part-part.mean())*np.hanning(len(part))
        corr = np.correlate(part, part, mode='full')[len(part)-1:]
        lo,hi = int(rate/230),int(rate/65)
        lag = lo+int(np.argmax(corr[lo:hi]))
        if corr[lag]/max(corr[0],1e-10)>.60: values.append(rate/lag)
    return round(float(np.median(values)),1) if values else None

if not reference.exists():
    print('Designing a Korean cinematic bass-baritone...', flush=True)
    model = load_model('mlx-community/Qwen3-TTS-12Hz-1.7B-VoiceDesign-4bit')
    mx.random.seed(922)
    rate, signal = save_results(model.generate(text=REFERENCE_TEXT, instruct=DESCRIPTION,
        lang_code='Korean', temperature=.9, top_p=1, max_tokens=180), reference)
    info = {'engine':'Qwen3-TTS VoiceDesign · MLX', 'description':DESCRIPTION,
            'referenceText':REFERENCE_TEXT,'sampleRate':rate,'duration':len(signal)/rate,
            'medianPitchHz':pitch_summary(signal,rate),'seed':922,
            'identity':'Original synthetic voice; no real person voice cloned.'}
    (WORK/'voice-design.json').write_text(json.dumps(info,ensure_ascii=False,indent=2))
    print(json.dumps(info,ensure_ascii=False),flush=True)
    del model
    gc.collect()
    mx.clear_cache()
if args.design_only:
    raise SystemExit(0)

print('Loading the consistent-voice speech model...', flush=True)
model = load_model('mlx-community/Qwen3-TTS-12Hz-1.7B-Base-4bit')
script = json.loads((ROOT/'tmp/odyssey/cinematic-voice-script.json').read_text())
manifest=[]
problems=[]
for i,line in enumerate(script):
    raw = WORK/f'{i:02d}-raw.wav'
    target = OUT/f'{i:02d}.wav'
    mx.random.seed({1:2201,10:3210}.get(i,21921+i))
    if not raw.exists():
        print(f'Generating {i+1}/{len(script)}: {line["text"]}', flush=True)
        if line['text']==REFERENCE_TEXT:
            shutil.copy2(reference,raw)
        else:
            save_results(model.generate(text=line['text'],ref_audio=str(reference),
                ref_text=REFERENCE_TEXT,lang_code='Korean',temperature=.65,top_p=.90,
                repetition_penalty=1.08,max_tokens=200),raw)
    subprocess.run(['ffmpeg','-hide_banner','-loglevel','error','-y','-i',str(raw),
        '-af','highpass=f=55,equalizer=f=105:t=q:w=0.8:g=2,acompressor=threshold=0.1:ratio=2.5:attack=15:release=180,loudnorm=I=-18:TP=-2:LRA=9',
        '-ar','48000','-ac','2',str(target)],check=True)
    duration=float(subprocess.check_output(['ffprobe','-v','error','-show_entries',
        'format=duration','-of','default=nw=1:nk=1',str(target)],text=True).strip())
    if duration > line['until']-line['at']:
        problems.append({'index':i,'duration':duration,'window':line['until']-line['at'],'text':line['text']})
    manifest.append({**line,'voice':'Original Korean cinematic bass-baritone',
        'engine':'Qwen3-TTS · MLX','voiceDesign':DESCRIPTION,'duration':duration,
        'tempo':1,'pitch':1,'file':f'voices-cinematic/{i:02d}.wav'})
    print(f'Voice {i+1}: {duration:.2f}s, window {line["until"]-line["at"]:.2f}s',flush=True)
(WORK/'manifest.json').write_text(json.dumps(manifest,ensure_ascii=False,indent=2))
(WORK/'timing-problems.json').write_text(json.dumps(problems,ensure_ascii=False,indent=2))
print('Voice generation finished. Timing problems:',json.dumps(problems,ensure_ascii=False),flush=True)
