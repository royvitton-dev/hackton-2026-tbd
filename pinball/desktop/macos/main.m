#import <Cocoa/Cocoa.h>

@interface DropLandDelegate : NSObject <NSApplicationDelegate, NSWindowDelegate>
@property NSWindow *window;
@property NSTextField *status;
@property NSButton *openButton;
@property NSTask *server;
@property NSURL *gameURL;
@property NSMutableData *output;
@property BOOL quitting;
@end

@implementation DropLandDelegate
- (void)applicationDidFinishLaunching:(NSNotification *)notification {
    NSMenu *menu=[NSMenu new];NSMenuItem *item=[NSMenuItem new];[menu addItem:item];
    NSMenu *appMenu=[NSMenu new];[appMenu addItemWithTitle:@"DROP LAND 종료" action:@selector(terminate:) keyEquivalent:@"q"];item.submenu=appMenu;NSApp.mainMenu=menu;
    self.window=[[NSWindow alloc] initWithContentRect:NSMakeRect(0,0,430,265) styleMask:NSWindowStyleMaskTitled|NSWindowStyleMaskClosable|NSWindowStyleMaskMiniaturizable backing:NSBackingStoreBuffered defer:NO];
    self.window.title=@"DROP LAND";self.window.delegate=self;self.window.releasedWhenClosed=NO;self.window.backgroundColor=[NSColor colorWithRed:.976 green:.957 blue:.914 alpha:1];[self.window center];
    NSTextField *title=[NSTextField labelWithString:@"✦ DROP LAND"];
    title.font=[NSFont boldSystemFontOfSize:32];title.textColor=[NSColor colorWithRed:.48 green:.29 blue:.85 alpha:1];title.alignment=NSTextAlignmentCenter;title.frame=NSMakeRect(25,175,380,48);[self.window.contentView addSubview:title];
    NSTextField *subtitle=[NSTextField labelWithString:@"행운이 굴러오는 작은 놀이공원"];
    subtitle.alignment=NSTextAlignmentCenter;subtitle.frame=NSMakeRect(25,149,380,25);[self.window.contentView addSubview:subtitle];
    self.status=[NSTextField wrappingLabelWithString:@"게임을 준비하고 있어요…"];self.status.alignment=NSTextAlignmentCenter;self.status.frame=NSMakeRect(25,96,380,40);self.status.textColor=NSColor.secondaryLabelColor;[self.window.contentView addSubview:self.status];
    self.openButton=[NSButton buttonWithTitle:@"브라우저에서 게임 열기 ↗" target:self action:@selector(openGame:)];self.openButton.frame=NSMakeRect(75,43,280,36);self.openButton.bezelStyle=NSBezelStyleRounded;self.openButton.enabled=NO;[self.window.contentView addSubview:self.openButton];
    [self.window makeKeyAndOrderFront:nil];[NSApp activateIgnoringOtherApps:YES];
    NSString *resources=NSBundle.mainBundle.resourcePath;
    self.server=[NSTask new];self.server.executableURL=[NSURL fileURLWithPath:[resources stringByAppendingPathComponent:@"runtime/node"]];
    self.server.arguments=@[[resources stringByAppendingPathComponent:@"server.mjs"]];self.server.currentDirectoryURL=[NSURL fileURLWithPath:resources];
    NSMutableDictionary *environment=[NSProcessInfo.processInfo.environment mutableCopy];[environment removeObjectForKey:@"NODE_OPTIONS"];[environment removeObjectForKey:@"NODE_PATH"];self.server.environment=environment;
    NSPipe *pipe=[NSPipe pipe];self.server.standardOutput=pipe;self.server.standardError=[NSFileHandle fileHandleWithNullDevice];self.output=[NSMutableData data];
    __weak DropLandDelegate *weakSelf=self;
    pipe.fileHandleForReading.readabilityHandler=^(NSFileHandle *handle){NSData *data=handle.availableData;if(!data.length){handle.readabilityHandler=nil;return;}dispatch_async(dispatch_get_main_queue(),^{
        DropLandDelegate *s=weakSelf;if(!s||s.gameURL)return;[s.output appendData:data];NSDictionary *message=[NSJSONSerialization JSONObjectWithData:s.output options:0 error:nil];
        NSString *url=message[@"url"];if([url hasPrefix:@"http://127.0.0.1:"]){s.gameURL=[NSURL URLWithString:url];s.status.stringValue=@"실행 중 · 이 창을 닫으면 게임 서버가 종료돼요.";s.openButton.enabled=YES;[s openGame:nil];}
    });};
    self.server.terminationHandler=^(NSTask *task){dispatch_async(dispatch_get_main_queue(),^{DropLandDelegate *s=weakSelf;if(s&&!s.quitting){s.status.stringValue=@"게임 서버가 종료됐어요. 앱을 다시 열어 주세요.";s.openButton.enabled=NO;}});};
    NSError *error=nil;if(![self.server launchAndReturnError:&error]){self.status.stringValue=[@"실행하지 못했어요: " stringByAppendingString:error.localizedDescription];}
}
- (void)openGame:(id)sender {if(self.gameURL)[NSWorkspace.sharedWorkspace openURL:self.gameURL];}
- (BOOL)applicationShouldHandleReopen:(NSApplication *)sender hasVisibleWindows:(BOOL)visible {[self.window makeKeyAndOrderFront:nil];[self openGame:nil];return YES;}
- (BOOL)applicationShouldTerminateAfterLastWindowClosed:(NSApplication *)sender {return YES;}
- (void)applicationWillTerminate:(NSNotification *)notification {self.quitting=YES;if(self.server.running)[self.server terminate];}
@end

int main(int argc,const char *argv[]){@autoreleasepool{NSApplication *app=NSApplication.sharedApplication;DropLandDelegate *delegate=[DropLandDelegate new];app.delegate=delegate;[app setActivationPolicy:NSApplicationActivationPolicyRegular];[app run];}return 0;}
