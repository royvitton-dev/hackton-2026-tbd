import {existsSync} from 'node:fs';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import path from 'node:path';

const project=fileURLToPath(new URL('../',import.meta.url));
export function runVision(args=[]){
  const local=path.join(project,'.runtime/vision-env',process.platform==='win32'?'Scripts/python.exe':'bin/python');
  const python=process.env.ATLAS_VISION_PYTHON||(existsSync(local)?local:'python3');
  const result=spawnSync(python,args,{cwd:project,stdio:'inherit',env:{...process.env,PYTHONDONTWRITEBYTECODE:'1'}});
  if(result.error)throw Error('Python 실행 실패. ATLAS_VISION_PYTHON 설정을 확인하세요. '+result.error.message);
  if(result.status!==0)throw Error(`Python 도면 분석 실패 (종료 ${result.status}). 위 분석 로그를 확인하세요. 의존성은 scripts/requirements-vision.txt에 고정되어 있습니다.`);
}
if(process.argv[1]===fileURLToPath(import.meta.url))runVision(process.argv.includes('--test')?['scripts/test_vision.py']:['scripts/analyze_drawings.py',...process.argv.slice(2)]);
