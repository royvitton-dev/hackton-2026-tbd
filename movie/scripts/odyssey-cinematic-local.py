"""Run LTX locally with the text encoder and connector in separate memory phases."""
import argparse
import gc
import hashlib
import json
import os
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
WORK = ROOT/'tmp/odyssey/cinematic'
WORK.mkdir(parents=True,exist_ok=True)
os.environ['HF_HUB_CACHE'] = str(ROOT/'tmp/odyssey/model-cache')
os.environ['HF_XET_CACHE'] = str(ROOT/'tmp/odyssey/xet-cache')
os.environ['LTX2_VAE_DECODE_BUDGET_GB'] = '4'
os.environ['LTX2_GEMMA_MAX_LENGTH'] = '256'

parser = argparse.ArgumentParser()
parser.add_argument('--shot',choices=['lift','victory'],default='lift')
parser.add_argument('--frames',type=int,default=None)
parser.add_argument('--encode-only',action='store_true')
args = parser.parse_args()

import mlx.core as mx
from ltx_pipelines_mlx.utils.blocks import PromptEncoder
from ltx_core_mlx.text_encoders.gemma.encoders.base_encoder import GemmaLanguageModel
from ltx_core_mlx.text_encoders.gemma.feature_extractor import GemmaFeaturesExtractorV2
from ltx_core_mlx.model.transformer.model import LTXModelConfig
from ltx_core_mlx.utils.weights import load_split_safetensors
from ltx_core_mlx.utils.memory import aggressive_cleanup

mx.set_memory_limit(12*1024**3)
mx.set_cache_limit(128*1024**2)

def encode_sequentially(self,prompt):
    signature=hashlib.sha256(prompt.encode()).hexdigest()[:20]
    cache=WORK/f'prompt-{signature}.safetensors'
    if cache.exists():
        data=mx.load(str(cache))
        return data['video'],data['audio']
    print('Encoding motion direction with Gemma...',flush=True)
    encoder=GemmaLanguageModel()
    encoder.load(self.gemma_model_id)
    hidden,mask=encoder.encode_all_layers(prompt,max_length=256)
    mx.eval(hidden,mask)
    del encoder
    gc.collect()
    aggressive_cleanup()
    print(f'Gemma released: {mx.get_active_memory()/1024**3:.2f} GiB active; loading the video text connector.',flush=True)
    config=LTXModelConfig.from_checkpoint_dir(self.model_dir)
    features=GemmaFeaturesExtractorV2(double_precision_rope=config.double_precision_rope)
    weights=load_split_safetensors(self.model_dir/'connector.safetensors',prefix='connector.')
    features.connector.load_weights(list(weights.items()))
    del weights
    video,audio=features(hidden,attention_mask=mask)
    mx.eval(video,audio)
    mx.save_safetensors(str(cache),{'video':video,'audio':audio})
    del features,hidden,mask
    gc.collect()
    aggressive_cleanup()
    print(f'Motion embeddings cached: {mx.get_active_memory()/1024**3:.2f} GiB active.',flush=True)
    return video,audio

# The unmodified pipeline loads both large components together. Sequential
# evaluation preserves exactly the same weights and outputs on this 18GB Mac.
PromptEncoder.load=lambda self: None
PromptEncoder.encode=encode_sequentially

if args.shot=='lift':
    prompt=('A continuous cinematic shot of the bearded Greek warrior shown in the image. '
        'He wears the same bronze helmet, worn armor and olive cloak. Both hands grip the '
        'small silver Mac mini computer on the stone altar. With great effort, his arms '
        'and shoulders tense, he lifts the compact silver computer and slowly rises from '
        'one knee. He brings the computer to his chest with both hands. The compact silver '
        'square computer stays rigid and keeps the same shape throughout. His face is solemn '
        'and exhausted. Two soldiers watch behind him. A breeze moves their cloaks, sea '
        'waves move in the distance. Camera gently pulls back and tilts up to follow his '
        'rise, keeping his entire helmet and computer visible. Realistic restrained human '
        'motion, natural dawn lighting, photoreal epic film. No talking, no text, no cuts.')
    reference=ROOT/'assets/odyssey/cinematic-hero-wide.png'
    frames=args.frames or 145
else:
    prompt=('A continuous cinematic shot, continuing the reference. The same bearded Greek '
        'warrior in bronze helmet and worn armor stands holding a small silver Mac mini '
        'computer securely at his chest with both hands. The compact silver square computer '
        'stays rigid and keeps the same shape. His shoulders settle after great '
        'effort. Breathing heavily, he slowly raises his gaze toward the dawn horizon. '
        'Solemn quiet triumph, no smile. His two companions step slightly closer behind '
        'him. The wind moves their olive cloaks, the sea glistens. Camera slowly tracks '
        'closer, keeping his helmet, face and the entire computer visible. Realistic live '
        'action film motion, preserve identity and costume. No dialogue, no text, no cuts.')
    reference=WORK/'lift-last-frame.png'
    frames=args.frames or 121
if args.encode_only:
    encoder=PromptEncoder(ROOT/'tmp/odyssey/ltx-model',str(ROOT/'tmp/odyssey/gemma-model'))
    video,audio=encode_sequentially(encoder,prompt)
    print(f'Prepared {args.shot} motion embeddings: {video.shape}, {audio.shape}',flush=True)
    sys.exit(0)
output=WORK/f'{args.shot}-raw.mp4'
request={'provider':'LTX-2.3 Distilled 1.1 / MLX local','shot':args.shot,
    'prompt':prompt,'reference':str(reference.relative_to(ROOT)),
    'output':str(output.relative_to(ROOT)),'frames':frames,'fps':24,
    'width':896,'height':384,'seed':92122,'status':'generating'}
(WORK/f'{args.shot}-request.json').write_text(json.dumps(request,ensure_ascii=False,indent=2))
sys.argv=['ltx-2-mlx','generate','--model',str(ROOT/'tmp/odyssey/ltx-model'),
    '--gemma',str(ROOT/'tmp/odyssey/gemma-model'),
    '--prompt',prompt,'--image',str(reference),'--distilled','--low-ram',
    '--no-audio','-W','896','-H','384','-f',str(frames),'--frame-rate','24',
    '--seed','92122','-o',str(output)]
try:
    from ltx_pipelines_mlx.cli import main
    main()
    if not output.exists():raise RuntimeError('No generated video output')
    request['status']='generated'
except BaseException as error:
    request.update(status='failed',error=str(error))
    raise
finally:
    (WORK/f'{args.shot}-request.json').write_text(json.dumps(request,ensure_ascii=False,indent=2))
