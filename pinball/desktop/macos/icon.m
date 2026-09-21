#import <Cocoa/Cocoa.h>
#include <math.h>
int main(int argc,const char *argv[]){@autoreleasepool{
 NSString *folder=[NSString stringWithUTF8String:argv[1]];[NSFileManager.defaultManager createDirectoryAtPath:folder withIntermediateDirectories:YES attributes:nil error:nil];
 for(NSNumber *number in @[@16,@32,@128,@256,@512])for(int scale=1;scale<=2;scale++){
  NSInteger size=number.integerValue,pixels=size*scale;
  NSBitmapImageRep *bitmap=[[NSBitmapImageRep alloc] initWithBitmapDataPlanes:nil pixelsWide:pixels pixelsHigh:pixels bitsPerSample:8 samplesPerPixel:4 hasAlpha:YES isPlanar:NO colorSpaceName:NSDeviceRGBColorSpace bytesPerRow:0 bitsPerPixel:0];bitmap.size=NSMakeSize(size,size);
  [NSGraphicsContext saveGraphicsState];NSGraphicsContext.currentContext=[NSGraphicsContext graphicsContextWithBitmapImageRep:bitmap];NSAffineTransform *transform=[NSAffineTransform transform];[transform scaleBy:size/1024.0];[transform concat];
  [[NSColor colorWithRed:.50 green:.33 blue:.86 alpha:1] setFill];[[NSBezierPath bezierPathWithRoundedRect:NSMakeRect(35,35,954,954) xRadius:220 yRadius:220] fill];
  NSBezierPath *star=[NSBezierPath bezierPath];for(int i=0;i<10;i++){double angle=i*M_PI/5+M_PI/2,radius=i%2==0?335:158;NSPoint point=NSMakePoint(512+cos(angle)*radius,512+sin(angle)*radius);if(i==0)[star moveToPoint:point];else[star lineToPoint:point];}[star closePath];[[NSColor colorWithRed:1 green:.86 blue:.51 alpha:1] setFill];[star fill];
  [[NSColor colorWithWhite:1 alpha:.9] setFill];[[NSBezierPath bezierPathWithOvalInRect:NSMakeRect(204,758,76,76)] fill];[NSGraphicsContext restoreGraphicsState];
  NSString *name=[NSString stringWithFormat:@"icon_%ldx%ld%@.png",(long)size,(long)size,scale==2?@"@2x":@""];[[bitmap representationUsingType:NSBitmapImageFileTypePNG properties:@{}] writeToFile:[folder stringByAppendingPathComponent:name] atomically:YES];
 }
}return 0;}
