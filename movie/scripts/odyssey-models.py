"""Download only the public model components used by this trailer."""
import argparse
import os
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
CACHE = ROOT / 'tmp/odyssey/model-cache'
os.environ['HF_HUB_CACHE'] = str(CACHE)
os.environ['HF_HUB_DISABLE_TELEMETRY'] = '1'
os.environ['HF_XET_CACHE'] = str(ROOT / 'tmp/odyssey/xet-cache')
os.environ['HF_XET_HIGH_PERFORMANCE'] = '0'
os.environ['HF_XET_FIXED_DOWNLOAD_CONCURRENCY'] = '32'
os.environ['HF_XET_RECONSTRUCTION_DOWNLOAD_BUFFER_LIMIT'] = str(2*1024**3)
from huggingface_hub import snapshot_download

parser = argparse.ArgumentParser()
parser.add_argument('kind', choices=['voice', 'video', 'text'])
args = parser.parse_args()
if args.kind == 'voice':
    for repo in ['mlx-community/Qwen3-TTS-12Hz-1.7B-VoiceDesign-4bit', 'mlx-community/Qwen3-TTS-12Hz-1.7B-Base-4bit']:
        print('Downloading voice model:', repo, flush=True)
        print(snapshot_download(repo, max_workers=3), flush=True)
elif args.kind == 'text':
    print(snapshot_download('mlx-community/gemma-3-12b-it-4bit', max_workers=3), flush=True)
else:
    files = ['*.json', 'LICENSE', 'README.md', 'connector.safetensors',
             'transformer-distilled-1.1.safetensors', 'vae_encoder.safetensors',
             'vae_decoder.safetensors', 'spatial_upscaler_x2_v1_1.safetensors',
             'audio_vae.safetensors', 'vocoder.safetensors']
    target = ROOT / 'tmp/odyssey/ltx-model'
    print('Downloading LTX components (unused development weights and LoRAs excluded).', flush=True)
    print(snapshot_download('dgrauet/ltx-2.3-mlx-q4', allow_patterns=files,
                            local_dir=target, max_workers=3), flush=True)
    print('Downloading the LTX text encoder.', flush=True)
    print(snapshot_download('mlx-community/gemma-3-12b-it-4bit', max_workers=3), flush=True)
print('Models ready.', flush=True)
