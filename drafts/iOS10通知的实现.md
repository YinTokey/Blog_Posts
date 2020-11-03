---
title: iOS10通知的实现
date: 2017-02-21 23:34:01
categories: Objective-C
---
2017年的WWDC将在6月5日-9日举办。
去年的WWDC，对于iOS10出现了很多新东西，SiriKit,锁屏，地图...
最大的改变可能还是把以往的通知都重新整合成了`UserNotifications.framework`
重新回顾了一下去年做的小项目中关于iOS10的通知，再增加了一些之前没能实现的特性，然后完成的本文的Demo。
关于这个framework，网上找了张图来帮助理解。
![](https://ww3.sinaimg.cn/large/006tNbRwgy1fcyipjpvydj30xk0iawng.jpg)
有了这张描述类关系的图，后面在写代码过程中会更容易理解。

iOS10的通知实现，根据Demo分成本地推送和远程推送来讲解一下。
# 本地通知
相对于过去单调的文字通知，iOS10可以在通知里加入更丰富的内容，包含图片，音频，视频。这些的实现是基于在通知内容里附加了attachment。官方把它定义为rich notification。虽然支持了在通知中加入了多媒体，但也不是可以毫无节制地添加。官方对于附件的大小给出了限制。
![](https://ww1.sinaimg.cn/large/006tNbRwgy1fcyj313fsvj30t809c0ui.jpg)
## 开始实现
一开始，还是和以前差不多，在AppDelegate里去注册通知，但是iOS10在注册方式上做了一些调整。
```
    // register notification
    if ([[UIDevice currentDevice].systemVersion floatValue] >= 10.0) {
        // iOS 10
        UNUserNotificationCenter *center = [UNUserNotificationCenter currentNotificationCenter];
        center.delegate = self;
        [center requestAuthorizationWithOptions:(UNAuthorizationOptionAlert | UNAuthorizationOptionBadge | UNAuthorizationOptionSound) completionHandler:^(BOOL granted, NSError * _Nullable error) {
            if (granted) {
                // click allow
                NSLog(@"注册通知成功");
                [center getNotificationSettingsWithCompletionHandler:^(UNNotificationSettings * _Nonnull settings) {
                    //NSLog(@"%@", settings);
                }];
            } else {
                // don't allow
                NSLog(@"注册通知失败");
            }
        }];
    }else{
        //  //iOS8 - iOS10
        [application registerUserNotificationSettings:[UIUserNotificationSettings settingsForTypes:UIUserNotificationTypeAlert | UIUserNotificationTypeSound | UIUserNotificationTypeBadge categories:nil]];
    }
```
然后实现代理方法，当收到通知时的相关处理
```
- (void)userNotificationCenter:(UNUserNotificationCenter *)center willPresentNotification:(UNNotification *)notification withCompletionHandler:(void (^)(UNNotificationPresentationOptions))completionHandler{
    
    if([notification.request.trigger isKindOfClass:[UNPushNotificationTrigger class]]) {

        NSLog(@"iOS10 收到远程通知");
        
    }else {

        NSLog(@"收到本地通知");
    }

    completionHandler(UNNotificationPresentationOptionBadge|
                      UNNotificationPresentationOptionSound|
                      UNNotificationPresentationOptionAlert);
    
}
```
当点击了通知栏的时候的相关处理。
```
// click event for notification
- (void)userNotificationCenter:(UNUserNotificationCenter *)center didReceiveNotificationResponse:(UNNotificationResponse *)response withCompletionHandler:(void(^)())completionHandler{

    NSLog(@"点击了通知栏");
    
    completionHandler();
    
}
```

接着去创建具体的通知，因为这个Demo需要创建4个类型的通知，所以我们在viewController里去创建。
![](https://ww1.sinaimg.cn/large/006tNbRwgy1fcyjr4hcnqj30eu0d2jrr.jpg)
我们需要先创建一个content,然后再根据需求去添加attachment。当然需要注意的是，content里只能添加最多一个attachment。
```
- (void)createLocalNotificationWithContent:(UNMutableNotificationContent *)content{

    content.title = @"title";
    content.subtitle = @"subtitle";
    content.body = @"body";
    content.badge = @1;
    UNNotificationSound *sound = [UNNotificationSound defaultSound];
    content.sound = sound;
    
    UNTimeIntervalNotificationTrigger *trigger1 = [UNTimeIntervalNotificationTrigger triggerWithTimeInterval:1.0 repeats:NO];
    
    NSString *requertID = @"requestID";
    UNNotificationRequest *request = [UNNotificationRequest requestWithIdentifier:requertID content:content trigger:trigger1];
    
    [[UNUserNotificationCenter currentNotificationCenter] addNotificationRequest:request withCompletionHandler:^(NSError * _Nullable error) {

    }]; 
}
```
`title,subtitle,body`这些都可以根据自己需要去自定义。这里的`trigger`根据第一张图，有4种触发方式，这里选择最简单的计时器触发。另外3种分别是周期日历触发，远程推送触发，地域触发。
然后根据按钮事件去选择通知内容的附件样式。我们这里4个按钮，前3种是多媒体的，最后一种则是动作样式。具体的可到时候看源码，这里只列举其中一种。
```
- (IBAction)videoClick:(id)sender {
    NSString *path = [[NSBundle mainBundle] pathForResource:@"video2" ofType:@"mp4"];
    UNNotificationAttachment *attachment = [UNNotificationAttachment attachmentWithIdentifier:@"videoAttachment" URL:[NSURL fileURLWithPath:path] options:nil error:nil];
    if(attachment){
        self.notificationContent.attachments = @[attachment];
    }
    
    [self createLocalNotificationWithContent:_notificationContent];
}
```
这个是视频附件的，需要注意的是，我们必须先在本地拥有文件，然后才能把它设置为通知内容的附件。
![](https://ww1.sinaimg.cn/large/006tNbRwgy1fcyk2doez4j30d208ywfp.jpg)
获取到通知，下拉即可点击播放视频。
![](https://ww2.sinaimg.cn/large/006tNbRwgy1fcyk48doy7j30fg0fwaen.jpg)

## 新特性：内容扩展
iOS10允许给通知添加自定义UI，我们需要创建一个target，选择Notification Content Extension。这个和一般的项目里一样，有storyboard和controller。
为了让我们的通知里能够显示自定义界面，我们需要配置一致的category。比如在这里
```
- (IBAction)actionClick:(id)sender {
    UNNotificationAction *action1 = [UNNotificationAction actionWithIdentifier:@"OK" title:@"确定" options:UNNotificationActionOptionForeground];
    
    UNNotificationAction *action2 = [UNNotificationAction actionWithIdentifier:@"Cancel" title:@"取消" options:UNNotificationActionOptionDestructive];
    UNNotificationCategory *category = [UNNotificationCategory categoryWithIdentifier:@"category" actions:@[action1,action2] intentIdentifiers:@[] options:UNNotificationCategoryOptionAllowInCarPlay];
    [[UNUserNotificationCenter currentNotificationCenter] setNotificationCategories:[NSSet setWithObject:category]];
    [[UNUserNotificationCenter currentNotificationCenter] setDelegate:self];
    self.notificationContent.categoryIdentifier = @"category";
    
    [self createLocalNotificationWithContent:_notificationContent];
}
```
我们创建了一个action的通知，把categoryIdentifier定义为`category`。与之对应的，在内容扩展的info.plist文件里，也把键UNNotificationExtensionCategory的值定义为`category`
![](https://ww1.sinaimg.cn/large/006tNbRwgy1fcz48uifk8j30x407kjt2.jpg)
图里的NSExtensionAttributes还有另外两个键，其中UNNotificationExtensionDefaultContentHidden,如果我们选择它的布尔值为YES,那么下拉通知将看不到通知的`title,subtile,body`,如下图
![](https://ww3.sinaimg.cn/large/006tNbRwgy1fcz4ke66hdj30h40m8jrv.jpg)
调整UNNotificationExtensionInitialContentSizeRatio的数值，可以调整自定义UI的高度。
# 远程推送
关于远程推送，这里着重介绍iOS10相关的新特性，以往的就不多做介绍了。首先需要自己去配置相关证书，至于如何配置，可以参考[这个](http://www.jianshu.com/p/8b6ad7294e71)
这里，还需要获取`Device Token`,大致原理如下图
![](https://ww4.sinaimg.cn/large/006tNbRwgy1fcz4ttkhzvj30ts0kotb7.jpg)
我们在AppDelegete里实现获取`Device Token`的代码
```
- (void)application:(UIApplication *)application didRegisterForRemoteNotificationsWithDeviceToken:(NSData *)deviceToken{

    NSString *deviceString = [[deviceToken description] stringByTrimmingCharactersInSet:[NSCharacterSet characterSetWithCharactersInString:@"<>"]];
    deviceString = [deviceString stringByReplacingOccurrencesOfString:@" " withString:@""];
    
    NSLog(@"deviceToken %@",deviceString); 
}
```
然后还需要一个pusher,这里推荐[NWPusher
](https://github.com/noodlewerk/NWPusher)
这里不对原来的远程推送做过多介绍，我们直接来实现iOS10新加入的特性`Notification Service Extension`
和刚刚创建内容扩展一样，我们选择新建target可以创建一个`Notification Service Extension`
接下来要实现根据图片URL，下载图片，然后在通知栏显示所下载的图片。运行结果如下
![](https://ww3.sinaimg.cn/large/006tNbRwgy1fcz5ds4zkcj30k00j2gnx.jpg)
![](https://ww2.sinaimg.cn/large/006tNbRwgy1fcz5cz0zq0j30jk0rsdpb.jpg)

实现原理如图
![](https://ww1.sinaimg.cn/large/006tNbRwgy1fcz5xnj86hj313y0h4wgh.jpg)
推送的内容里包含里图片的URL，然后在service Extension里去实现下载保存操作。

```
- (void)didReceiveNotificationRequest:(UNNotificationRequest *)request withContentHandler:(void (^)(UNNotificationContent * _Nonnull))contentHandler {
    self.contentHandler = contentHandler;
    self.bestAttemptContent = [request.content mutableCopy];
    
    NSString * imageUrlStr = [request.content.userInfo objectForKey:@"image"];
    //下载图片
    NSData * data = [NSData dataWithContentsOfURL:[NSURL URLWithString:imageUrlStr]];
    UIImage * image = [UIImage imageWithData:data];
    //保存到本地
    NSArray * paths = NSSearchPathForDirectoriesInDomains(NSDocumentDirectory, NSUserDomainMask, YES);
    NSString * documentsDirectoryPath = [paths firstObject];
    NSString * localPath = [documentsDirectoryPath stringByAppendingPathComponent:[NSString stringWithFormat:@"%@.%@", @"notificationImage", @"png"]];
    [UIImagePNGRepresentation(image) writeToFile:localPath options:NSAtomicWrite error:nil];
    
    if (localPath && ![localPath isEqualToString:@""]) {
        UNNotificationAttachment * attachment = [UNNotificationAttachment attachmentWithIdentifier:@"image" URL:[NSURL fileURLWithPath:localPath] options:nil error:nil];
        if (attachment) {
            self.bestAttemptContent.attachments = @[attachment];
        }
    }
    self.contentHandler(self.bestAttemptContent);
    
}
```
以下是我推送的aps
```
{
   "aps":{
        "alert" : {
             "title" : "title",
              "subtitle" : "Subtitle",
              "body" : "body of remote notification"
            },
        "sound" : "default",
        "badge" : "1",
        "mutable-content" : "1",
        "category" : "category"
    },
    "image" : "https://ww4.sinaimg.cn/large/006tNbRwgy1fcyic6gcuvj305y03mq4a.jpg",
    "type" : "scene",
    "id" : "1"
}
```
![](https://ww1.sinaimg.cn/large/006tNbRwgy1fcz5l33fq9j311g0nq772.jpg)
这里需要注意，里面的键`category`对应的值，和我们内容扩展里的`category`一致，才能显示我们的自定义UI，否则拉下来，显示的一般形式，这个可以自己去尝试一下。

介绍到这里，也差不多结束了。总之原来项目里有涉及到通知的，是很值得升级为iOS10通知的新特性。
# Demo
[本文Demo](https://github.com/YinTokey/iOS10NotificationDemo)

# 参考文章
http://www.jianshu.com/p/81c6bd16c7ac


