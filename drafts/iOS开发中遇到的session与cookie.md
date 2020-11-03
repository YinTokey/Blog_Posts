---
title: iOS开发中遇到的session与cookie
date: 2016-08-20 23:32:52
categories: Objective-C
---
首先借用一下《图解http》里的图片，加上自己的总结，介绍一下cookie和session
## coolkie
http是无状态协议，不对之前的请求和响应管理，为了解决这个问题而引入了cookie。用个通俗的比喻，cookie就类似于单机游戏的存档文件，每次启动游戏，如果有存档文件，就可以继续，如果没有，那么每次都要重新创建一份游戏存档，区别在于游戏存档文件没有过期时间，cookie会过期。
有cookie的http通信过程如下（借用书本图片）
![](https://github.com/YinTokey/YinTokey.github.io/blob/master/picture/iOS%E4%B8%ADsession%20cookie/screenshot.png?raw=true)

## session
承接上图。服务器创建了一个session会话，响应cookie给客户端，cookie里包含了session ID。下次再请求的时候，客户端在请求里携带了cookie，cookie里有session ID,服务端拿到cookie后，根据里面的session ID就可以识别客户端的身份。cookie里还包含了过期的日期，这个日期就是session会话的有效期。session会话期过了，那么客户端的这个请求，服务端会返回错误信息。就好比客户端，服务端是两个相识的人，但是服务端session有效期过了，它就失忆了，不再认识客户端了。
那么再细说一下，sesssion它其实是一个数据结构，在服务端，它可以保存在集群，数据库，文件中。

## 实现细节
一般项目里会用到验证码验证用户的功能。session会话的有效期是24小时。需要在验证成功后，将cookie保存在本地24小时，如果过了24小时，那么就需要向服务器请求验证码。
保存cookie
```
+ (void)saveCookieWithDate:(NSDate *)date{
    NSArray *cookies = [[NSHTTPCookieStorage sharedHTTPCookieStorage]cookies];
    NSHTTPCookie *cookie = [cookies objectAtIndex:0];
    NSData *cookieData = [NSKeyedArchiver archivedDataWithRootObject:cookie];
    NSDictionary *cookieDictionary = @{@"cookie":cookieData,
                                       @"date":date};
    
    NSUserDefaults *userDefaults = [NSUserDefaults standardUserDefaults];
    [userDefaults setObject:cookieDictionary forKey:@"cookieDictionary"];
}
```
读取和设置cookie
```
+ (BOOL)setCookie{
    NSUserDefaults *userDefaults = [NSUserDefaults standardUserDefaults];
    NSDictionary *cookieDictionary = [userDefaults objectForKey:@"cookieDictionary"];

    //如果有cookie,则设置比较时间，条件满足24小时内再设置cookie,否则也是返回 NO
    if (cookieDictionary) {
        NSData *cookieData = [cookieDictionary objectForKey:@"cookie"];
        NSDate *date = [cookieDictionary objectForKey:@"date"];
        //获取系统时间来互相比较
        NSDate *systemDate = [NSDate date];
        NSTimeInterval interval = [systemDate timeIntervalSinceDate:date];
        NSInteger resultInterval = ((NSInteger)interval);
        if (resultInterval <= 24*3600) {
            NSHTTPCookie *cookie = [NSKeyedUnarchiver unarchiveObjectWithData:cookieData];
            NSHTTPCookieStorage *cookieStorage = [NSHTTPCookieStorage sharedHTTPCookieStorage];
            [cookieStorage setCookie:cookie];
            return YES;
        }else{
            return NO;
        }
    }else{
        return NO;
    }
}
```

在实际调用的时候，根据setCookie返回的的BOOL来判断是否重新验证。
## 一个易错细节
AFNetworking会自动帮助管理cookie，但是app每次重启，包括每次重新编译运行程序的时候，cookie都会被重置，每次修改代码后，重新编译，发送请求时，cookie都是不一样的。正是因为这个问题，所有才有了上面的saveCookieWithDate,setCookie。我们通过setCookie就可以在24小时内读取同一个cookie，让它依附在请求中，避免了不断进行验证的困扰。

