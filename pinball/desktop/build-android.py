#!/usr/bin/env python3
"""Build an offline APK from Maven-distributed open-source Android tools."""
import argparse,pathlib,subprocess,tempfile,zipfile,hashlib,json,struct
p=argparse.ArgumentParser();p.add_argument('--tools',required=True);p.add_argument('--keystore',required=True);p.add_argument('--out',required=True);a=p.parse_args()
source=pathlib.Path(__file__).resolve().parent/'android';game=source.parent.parent/'dist';tools=pathlib.Path(a.tools).resolve();out=pathlib.Path(a.out).resolve();key=pathlib.Path(a.keystore).resolve();key.parent.mkdir(parents=True,exist_ok=True);out.parent.mkdir(parents=True,exist_ok=True)
java=list((tools/'jdk').glob('*/Contents/Home/bin/java'))[0];javac=java.with_name('javac');keytool=java.with_name('keytool');aapt=tools/'aapt2/aapt2';framework=tools/'android-all.jar'
def run(args):subprocess.run([str(x) for x in args],check=True)
if not key.exists():run([keytool,'-genkeypair','-keystore',key,'-storetype','PKCS12','-storepass','android','-keypass','android','-alias','dropland','-keyalg','RSA','-keysize','3072','-validity','10000','-dname','CN=DROP LAND Local Build, O=DROP LAND, C=KR'])
with tempfile.TemporaryDirectory(prefix='dropland-apk-') as temp:
 w=pathlib.Path(temp);classes=w/'classes';classes.mkdir();dex=w/'dex';dex.mkdir();generated=w/'generated';generated.mkdir()
 run([aapt,'compile','--dir',source/'res','-o',w/'resources.zip'])
 run([aapt,'link','-o',w/'base.apk','--manifest',source/'AndroidManifest.xml','-I',framework,'--java',generated,'--auto-add-overlay','--min-sdk-version','26','--target-sdk-version','35',w/'resources.zip'])
 run([javac,'--release','8','-classpath',framework,'-d',classes,*source.glob('src/**/*.java'),*generated.glob('**/*.java')])
 run([java,'-cp',tools/'r8.jar','com.android.tools.r8.D8','--lib',framework,'--lib',java.parent.parent,'--min-api','26','--output',dex,*classes.glob('**/*.class')])
 # Repack while aligning every uncompressed entry (including resources.arsc) to 4 bytes.
 with zipfile.ZipFile(w/'base.apk') as initial,zipfile.ZipFile(w/'unsigned.apk','w') as result:
  for item in initial.infolist():
   data=initial.read(item.filename);entry=zipfile.ZipInfo(item.filename);entry.compress_type=item.compress_type
   if entry.compress_type==zipfile.ZIP_STORED:
    offset=result.fp.tell()+30+len(entry.filename.encode('utf-8'));padding=(-(offset+4))%4;entry.extra=struct.pack('<HH',0xD935,padding)+b'\0'*padding
   result.writestr(entry,data)
  for file in game.rglob('*'):
   if file.is_file():result.write(file,'assets/game/'+str(file.relative_to(game)),compress_type=zipfile.ZIP_DEFLATED)
  result.write(dex/'classes.dex','classes.dex',compress_type=zipfile.ZIP_DEFLATED)
 signer=w/'signer';signer.mkdir();run([javac,'-cp',tools/'apksig.jar','-d',signer,source/'SignApk.java'])
 run([java,'-cp',str(signer)+':'+str(tools/'apksig.jar'),'SignApk',key,w/'unsigned.apk',out])
 with zipfile.ZipFile(out) as z:
  assert z.testzip() is None
  for f in game.rglob('*'):
   if f.is_file():assert z.read('assets/game/'+str(f.relative_to(game)))==f.read_bytes()
  assert 'classes.dex' in z.namelist()
 run([aapt,'dump','badging',out])
receipt={'platform':'Android','package':'com.dropland.game','minSdk':26,'targetSdk':35,'apkBytes':out.stat().st_size,'sha256':hashlib.sha256(out.read_bytes()).hexdigest(),'networkPermission':False,'assetsMatchBuiltGame':True,'signing':'local development certificate; private keystore excluded from deliverables','deviceExecution':'NOT RUN'}
out.with_suffix('.build.json').write_text(json.dumps(receipt,indent=2)+'\n');print('Built:',out)
