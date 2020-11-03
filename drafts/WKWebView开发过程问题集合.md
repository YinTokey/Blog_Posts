---
title: WKWebView开发过程问题整理
date: 2018-03-23 23:56:59
categories: WebView
---

本篇主要记录自己在 iOS 开发中使用两种 WebView 和协助前端人员适配过程中所遇到的一些问题，也包含了对其他文档的收集，如果你在使用 WebView 开发过程遇到了一些问题，也许这篇文档能为解决问题提供一些思路上的参考。在往后的开发中再遇到新的问题，会不断地补充进来。

### 1. iOS9中UIWebView/WKWebView里面请求数据失败
这个问题，Google 一下可以找到大量接近雷同的答案，无非就是在 Info.plist 里面添加 App Transport Security Settings，并进行配置。喵神对于这个问题做了非常详细的讲解，推荐[他的文章](https://onevcat.com/2016/06/ios-10-ats/)。但是自己在开发中有遇到过一个非常奇怪的问题，就是在iOS10和iOS11上一切正常，但是在iOS9里面无法加载请求。而且使用 UIWebView 或者 WKWebView 去加载普通的网页是可以加载成功的，但是在项目的 Web 端里的 javascript 请求网络数据失败。经过排查和测试，发现问题具体表现在在 Web 端使用 fetch 去请求数据，在 iOS 中会失败，似乎和客户端的配置没有太大关系。前端开发人员在对应的地方使用 Ajax 代替 原来 fetch 去请求同一个接口就能成功。如果说你们在开发中这种问题，也许需要和前端人员协调，在前端做相应的适配处理。

### 2.iOS8 中的 WKWebView
虽然苹果建议在iOS8以上就使用WKWebView，但是实际上iOS8上使用WKWebView无法直接加载工程中的资源文件，只能在程序运行时将项目目录中资源文件拷贝到沙盒中。[这一篇](https://blog.methodname.com/jin-jie-pian-iosshi-yong-wkwebviewhun-bian-kai-fa/)末尾的方法可以作为参考。

### 3.Web存储
iOS9 上 WebSQL 无法使用。至于 IndexedDB 按照文档描述是可以在 iOS9 以上的 WKWebView 中被支持的。根据个人实战情况，在 iOS10 中正常，在iOS9中的WKWebView 里面使用IndexedDB 会出现数据库打开失败的情况，这涉及到跨域问题，在下一条，给出具体的解决方式。也可以考虑把数据存在客户端或者使用兼容性较好的 [LocalStorage](https://developer.mozilla.org/en-US/docs/Web/API/Storage/LocalStorage)。

### 4.跨域问题
在使用 WKWebView 访问一些数据时，浏览器调试窗口出现了跨域错误信息。经了解，UIWebView 是允许跨域的，而WKWebView并不允许。跨域问题，有两种解决方式，一种是在`decidePolicyForNavigationAction`代理方法里独立处理，可以参考[这个链接](https://www.jianshu.com/p/ddf2aba71a29)，另一种方法更加简洁，通过KVC来设置：
```
 webview.configuration.preferences.setValue(true, forKey: "allowFileAccessFromFileURLs")
```

该解决方式的[原文链接](https://stackoverflow.com/questions/46996292/ios-wkwebview-cross-origin-requests-are-only-supported-for-http)。第二种解决方式有另一个好处，在上方有提及 Web 存储问题，通过这种 KVC 设置，其实也顺便解决了iOS9中使用 WKWebView 打开 IndexedDB 的问题。

### 5.自动播放问题
有时候打开网页，希望让它自动播放背景音乐。但是苹果对于为了避免流量的浪费，这种功能进行了限制，必须至少用户点一下屏幕，才会播放音乐。相关内容可以[参考这篇](https://imququ.com/post/new-video-policies-for-ios10.html)，对于iOS9以上，在WkWebView中，可以对它 configuration 里的一个属性 `requiresUserActionForMediaPlayback` 设置为 NO 来允许自动播放。对于iOS8的在WkWebView中，则是设置 `mediaPlaybackRequiresUserAction`为 NO。

### 6.iOS9 WKWebView 的本地文件问题
在 iOS8 中，WKWebView 无法加载本地资源文件，在很多博客上都有介绍这个问题，并提供了可行的解决方案，那就是在运行时把相关资源文件拷贝到沙盒里。在本篇的第二条也说到了这个问题。在 iOS9 里，WKWebView 已经可以正常加载项目目录里的 html 和图片资源。但是苹果并没有彻底修复这个问题，当你在 html 中使用 audio 加载项目目录里的本地 mp3 文件时，会发现在 iOS9 里无法播放，而在 iOS10 以上是可以正常播放的。猜测是 iOS9 的 WKWebView 没有将 iOS8 暴露出来的问题修复完全，本地 mp3 的加载给遗漏了。至于还有没有其他类型的本地文件在 iOS9 的 WKWebView 无法加载，本人并没有把所有文件都尝试过。在此提供一个这类问题的排查思路：

- 如果 iOS9 加载不出来，而 iOS10 以上可以加载出来。
- iOS9 种在线调试可以加载出资源，但是把资源打包放进项目本地目录里无法加载。

出现以上这两种情况，就考虑是不是你要加载的资源文件在 iOS9 的 WKWebView 中无法实现本地加载。如果是的话，那就参考 iOS8 的解决方式，先判断系统版本，如果是 iOS10 以下，就将部分资源或者整个资源文件夹在运行时拷贝到沙盒中，虽然在一定程度上会影响运行效率，但这是目前我所能找到的比较合适的方法了。如果你有更好的建议，请留言告诉我，万分感谢。

### 其他参考文档
**1.** [腾讯Bugly](https://mp.weixin.qq.com/s/rhYKLIbXOsUJC_n6dt9UfA)，这篇总结了很多多经典的坑。
**2.** [WKWebView 的接口中文文档](https://cloud.tencent.com/developer/article/1033743)，介绍得非常详细，个人认为比苹果更详细。


