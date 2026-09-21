#!/usr/bin/env python3
"""Build a self-contained arm64 macOS launcher with a user-supplied Node runtime."""
import argparse, pathlib, subprocess, shutil, plistlib, hashlib, json, tempfile
p=argparse.ArgumentParser();p.add_argument('--node',required=True);p.add_argument('--node-license',required=True);p.add_argument('--out',required=True);a=p.parse_args()
source=pathlib.Path(__file__).resolve().parent;game=source.parent/'dist';out=pathlib.Path(a.out).resolve();app=out/'DROP LAND.app';contents=app/'Contents';resources=contents/'Resources'
assert (game/'index.html').exists(),'Run node scripts/build.mjs first.'
for d in [contents/'MacOS',resources/'runtime']:d.mkdir(parents=True,exist_ok=True)
shutil.copytree(game,resources/'game',dirs_exist_ok=True);shutil.copy2(a.node,resources/'runtime/node');shutil.copy2(a.node_license,resources/'runtime/NODE-LICENSE.txt');shutil.copy2(source/'macos/server.mjs',resources/'server.mjs')
info={'CFBundleName':'DROP LAND','CFBundleDisplayName':'DROP LAND','CFBundleIdentifier':'com.dropland.mac','CFBundleVersion':'1','CFBundleShortVersionString':'1.0','CFBundleExecutable':'DropLand','CFBundlePackageType':'APPL','CFBundleIconFile':'AppIcon','LSMinimumSystemVersion':'13.5','NSHighResolutionCapable':True,'NSSupportsAutomaticTermination':False}
with (contents/'Info.plist').open('wb') as f:plistlib.dump(info,f)
subprocess.run(['clang','-fobjc-arc','-mmacosx-version-min=13.5','-framework','Cocoa',str(source/'macos/main.m'),'-o',str(contents/'MacOS/DropLand')],check=True)
with tempfile.TemporaryDirectory(prefix='dropland-icon-') as temp:
    iconset=pathlib.Path(temp)/'AppIcon.iconset';binary=pathlib.Path(temp)/'icon'
    subprocess.run(['clang','-fobjc-arc','-framework','Cocoa',str(source/'macos/icon.m'),'-o',str(binary)],check=True);subprocess.run([str(binary),str(iconset)],check=True);subprocess.run(['iconutil','-c','icns',str(iconset),'-o',str(resources/'AppIcon.icns')],check=True)
subprocess.run(['codesign','--force','--sign','-',str(app)],check=True)
subprocess.run(['codesign','--verify','--deep','--strict',str(app)],check=True)
receipt={'platform':'macOS arm64','minimumOS':'13.5','nodeVersion':subprocess.check_output([a.node,'--version'],text=True).strip(),'assets':{str(f.relative_to(game)):hashlib.sha256(f.read_bytes()).hexdigest() for f in game.rglob('*') if f.is_file()},'signing':'local ad-hoc; not Apple notarized'}
(out/'build-receipt.json').write_text(json.dumps(receipt,indent=2)+'\n');print('Built:',app)
