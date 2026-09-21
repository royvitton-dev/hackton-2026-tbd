import com.android.apksig.ApkSigner;
import com.android.apksig.ApkVerifier;
import java.io.*;
import java.security.*;
import java.security.cert.X509Certificate;
import java.util.*;
public class SignApk {
 public static void main(String[] args) throws Exception {
  KeyStore store=KeyStore.getInstance("PKCS12");try(InputStream stream=new FileInputStream(args[0])){store.load(stream,"android".toCharArray());}
  ApkSigner.SignerConfig signer=new ApkSigner.SignerConfig.Builder("dropland-local",(PrivateKey)store.getKey("dropland","android".toCharArray()),List.of((X509Certificate)store.getCertificate("dropland"))).build();
  new ApkSigner.Builder(List.of(signer)).setInputApk(new File(args[1])).setOutputApk(new File(args[2])).setMinSdkVersion(26).setV1SigningEnabled(true).setV2SigningEnabled(true).setV3SigningEnabled(true).setV4SigningEnabled(false).build().sign();
  ApkVerifier.Result result=new ApkVerifier.Builder(new File(args[2])).setMinCheckedPlatformVersion(26).build().verify();
  if(!result.isVerified())throw new IllegalStateException("APK signature verification failed: "+result.getErrors());
  System.out.println("PASS APK signature v1="+result.isVerifiedUsingV1Scheme()+" v2="+result.isVerifiedUsingV2Scheme()+" v3="+result.isVerifiedUsingV3Scheme());
 }
}
