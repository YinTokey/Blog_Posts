本篇指南是基于[这篇文章](http://oriochan.com/cocoapods.html)。作者使用的是 GitLab。本篇文章将使用 Github。

在实现项目组件化的时候，需要使用Pod私有库来管理组件。网上有很多类似教程，但并不是每个教程都能完全适用于个人情况。在经过了一系列踩坑之后，总结出了较为适合自己的私有库搭建步骤。

## 私有库创建
**1.** 先在 GitHub 上创建一个新的空项目，执行下面命令，把自己的Spec Repo添加到~/.cocoapods/repos目录下。这里仓库地址使用 http，如果是 SSH 则可能需要自己做一些额外处理。
```
pod repo add 本地仓库名称 github仓库地址
// 如下
pod  repo add github-specs https://github.com/YinTokey/UserModule.git
```
**2.** 在本地创建 Pod 项目。创建 Pod 项目有两种方式，一种是手动创建，像一般的iOS 项目那样直接用 Xcode建一个。一种是自动创建，使用下面命令，生成一个模板。个人倾向于手动创建的方式，下面介绍的方式也是使用手动创建。
```
pod lib create 项目名称   // 之后会有4步让你选，根据实际需要选择
```
所建完的项目是该 Pod 库的例子。如图

![](https://ws2.sinaimg.cn/large/006tKfTcgy1fqh5bwrhpvj308c09074w.jpg)

像常规的项目开发一样。建一个文件夹，文件夹内的文件 `BasicUser.swift`，将作为库的一部分。后面通过 `.podspec`文件配置后，就可以将 `BasicUser.swift`暴露给其他项目使用，而该例子项目里的非`UserLogin`文件夹里的文件不会暴露出去。

**3.** 在终端 cd 到该项目下，执行下面命令添加远程仓库。 

```
git remote add origin https://github.com/YinTokey/UserModule.git
```
**4.** 继续在该目录下，执行下面命令创建一个 LICENSE 
```
echo MIT>LICENSE
```
**5.** 继续在该目录下，执行下面命令创建 podspec (UserLogin为库的名称)
```
pod spec create UserModule
```
**6.** 编辑生成的 `UserLogin.podspec` 文件。这里直接放上编程完成的文件，更多配置，自行 Google。
```
Pod::Spec.new do |s|
  s.name             = "UserModule"
  s.version          = "0.1.0"
  s.summary          = "UserModule summary"
  s.description      = "UserModule description"
  s.homepage         = "http://www.baidu.com"
  s.license          = "MIT"
  s.author           = "YinTokey"
  s.source           = { :git => "https://github.com/YinTokey/UserModule.git", :tag => s.version }
  s.platform     = :ios, "9.0"
  s.swift_version = "4.0"
  s.source_files = "UserModule-master/UserModule/*"
end
```
其中 `s.source_files = "UserModule-master/UserModule/*"` 就是库的文件路径。
**7.** 编辑完文件后，执行`pod lib lint` 检查 .podspec 文件的合法性，并根据报错信息修改。
**8.** 通过第7步的 pod 检查后，依次执行下面命令，将项目推上远程仓库。
```
git add .
git commit -m "log"  #提交描述
git push origin master #推送仓库
git tag -m "vsersion_0.1.0" 0.1.0 #其中 version_0.1.1是标签描述， 0.1.0 是标签名，标签名必须和 .podspec 文件里的version一致。
git push --tags
git repo add UserModule-master https://github.com/YinTokey/UserModule.git #UserModule-master 为本地仓库名，后面第地址为 pod 远程仓库地址
pod repo push UserModule-master UserModule.podspec #UserModule-master UserModule.podspec 自行替换
```
**9.**到此，私有库建立基本完成。接下来是引用。在某个需要引用该私有库的项目的 Podfile 文件顶部，加入下面两行

