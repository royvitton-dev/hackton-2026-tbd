"""Resumable HTTP ranges with final verification against official HF SHA-256."""
import argparse
import concurrent.futures
import hashlib
import json
import os
import shutil
import threading
import time
from pathlib import Path

import httpx
from huggingface_hub import HfApi

ROOT=Path(__file__).resolve().parents[1]
parser=argparse.ArgumentParser()
parser.add_argument('kind',choices=['video','text'])
parser.add_argument('--workers',type=int,default=16)
parser.add_argument('--probe',action='store_true')
parser.add_argument('--probe-file',default='connector.safetensors')
parser.add_argument('--probe-chunks',type=int,default=8)
parser.add_argument('--host',default='https://huggingface.co')
args=parser.parse_args()
repo='dgrauet/ltx-2.3-mlx-q4' if args.kind=='video' else 'mlx-community/gemma-3-12b-it-4bit'
target=ROOT/('tmp/odyssey/ltx-model' if args.kind=='video' else 'tmp/odyssey/gemma-model')
target.mkdir(parents=True,exist_ok=True)
record=target/'model-source.json'
saved=json.loads(record.read_text()) if record.exists() else {}
revision=saved.get('revision') if saved.get('repository')==repo else None
info=HfApi().model_info(repo,revision=revision,files_metadata=True)
allow={'connector.safetensors','transformer-distilled-1.1.safetensors','vae_encoder.safetensors','vae_decoder.safetensors','spatial_upscaler_x2_v1_1.safetensors'}
files=[f for f in info.siblings if args.kind=='text' or f.rfilename in allow or f.rfilename.endswith('.json')]
files.sort(key=lambda f:(not f.rfilename.endswith('.json'),f.size or 0))
(target/'model-source.json').write_text(json.dumps({
    'repository':repo,'revision':info.sha,
    'files':[{'path':f.rfilename,'size':f.size,
              'sha256':f.lfs.sha256 if f.lfs else None} for f in files]
},indent=2)+'\n')
if args.probe:files=[next(f for f in files if f.rfilename==args.probe_file)]
CHUNK=8*1024**2
started=time.monotonic()
count=0
last_report=started
lock=threading.Lock()
client=httpx.Client(follow_redirects=True,timeout=httpx.Timeout(120,connect=30),limits=httpx.Limits(max_connections=args.workers,max_keepalive_connections=args.workers))

def digest(file):
    h=hashlib.sha256()
    with file.open('rb') as stream:
        for data in iter(lambda:stream.read(8*1024**2),b''):h.update(data)
    return h.hexdigest()

for file in files:
    name=file.rfilename
    dest=target/name
    size=file.size
    expected=file.lfs.sha256 if file.lfs else None
    if dest.exists() and dest.stat().st_size==size and (not expected or digest(dest)==expected):
        print('Verified existing:',name,flush=True)
        continue
    dest.parent.mkdir(parents=True,exist_ok=True)
    url=f'{args.host}/{repo}/resolve/{info.sha}/{name}'
    if size<CHUNK:
        response=client.get(url);response.raise_for_status()
        assert len(response.content)==size,(name,len(response.content),size)
        dest.write_bytes(response.content)
        if expected:assert digest(dest)==expected
        print('Downloaded:',name,flush=True)
        continue
    parts=target/'.http-parts'/name
    parts.mkdir(parents=True,exist_ok=True)
    chunks=list(range((size+CHUNK-1)//CHUNK))
    if args.probe:chunks=chunks[:args.probe_chunks]
    print('HTTP download:',name,round(size/1e6),'MB;',len(chunks),'chunks',flush=True)
    def fetch(index):
        global count,last_report
        start=index*CHUNK;end=min(size-1,start+CHUNK-1);length=end-start+1
        part=parts/f'{index:06d}.part'
        if part.exists() and part.stat().st_size==length:return
        tmp=part.with_suffix('.partial')
        for attempt in range(6):
            try:
                received=tmp.stat().st_size if tmp.exists() else 0
                if received>length:
                    tmp.unlink();received=0
                if received<length:
                    offset=start+received
                    with client.stream('GET',url,headers={
                        'Range':f'bytes={offset}-{end}','Accept-Encoding':'identity'
                    }) as response:
                        if response.status_code==429:
                            time.sleep(max(30,float(response.headers.get('Retry-After','30'))))
                            continue
                        response.raise_for_status()
                        assert response.status_code==206
                        assert response.headers.get('Content-Range')==f'bytes {offset}-{end}/{size}',response.headers.get('Content-Range')
                        with tmp.open('ab') as output:
                            for block in response.iter_raw(chunk_size=256*1024):
                                output.write(block)
                assert tmp.stat().st_size==length
                tmp.replace(part)
                with lock:
                    count+=length
                    now=time.monotonic()
                    if args.probe or now-last_report>=15:
                        print(f'{name}: received {count/1e6:.0f} MB; {count/1e6/max(1,now-started):.2f} MB/s',flush=True)
                        last_report=now
                return
            except Exception as error:
                print('Retry:',name,index,type(error).__name__,str(error).split('https:')[0][:80],flush=True)
                if attempt==5:raise
                time.sleep(2*(attempt+1))
        raise RuntimeError('Download did not complete')
    with concurrent.futures.ThreadPoolExecutor(max_workers=args.workers) as pool:
        list(pool.map(fetch,chunks))
    if args.probe:
        print('Probe completed:',round(time.monotonic()-started,1),'seconds',flush=True)
        break
    candidate=dest.with_suffix(dest.suffix+'.assembling')
    with candidate.open('wb') as output:
        for index in chunks:
            with (parts/f'{index:06d}.part').open('rb') as source:shutil.copyfileobj(source,output)
    assert candidate.stat().st_size==size
    if expected:assert digest(candidate)==expected,'Official model SHA-256 mismatch'
    candidate.replace(dest)
    shutil.rmtree(parts)
    print('Verified SHA-256:',name,flush=True)
print('HTTP download complete.',flush=True)
