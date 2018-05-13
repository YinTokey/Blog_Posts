关于[Moya](https://github.com/Moya)的介绍，如果不了解可以点击链接到它的主页上，对于Moya内部实现感兴趣的，可查看[这篇文章](https://juejin.im/post/5a69e9f9f265da3e290c6782)。本篇侧重于分享一种简单的小技巧。

### 问题背景
Moya以其简洁的特性获得了不少人的喜欢，只需要经过类似下面的枚举配置就可以用于请求数据
```
var path: String {
   switch self {
   case .zen:
       return "/zen"
   case .showUser(let id), .updateUser(let id, _, _):
       return "/users/\(id)"
   case .createUser(_, _):
       return "/users"
   case .showAccounts:
       return "/accounts"
   }
}

```
**然而**细心的你不知是否发现了一个问题：按照作者缩写的文档思路，所有的请求配置都将写在文件里，小项目写起来并不会有什么问题，但是稍微大一点的项目呢？想象一下如果一个项目如果有超过100个接口，那么Moya的配置文件像上面那样写起来是什么样子的？———— **上百个并列的case,满屏幕的case**
![](/Users/ChenYinjian/Desktop/URL技巧图/1.png)

这种情况容易让业务开发者感到不适，而且多人开发时会频繁地修改唯一一个配置文件，增大了代码冲突，误删误改的风险。

### 一种解决技巧
考虑到多人开发中，单个业务模块常常是有一个人开发维护，那么我们像工程目录那样，对于接口配置也按照业务进行分块管理。

以**网易公开课**的接口为例子,这里取3个模块，实际情况在一个项目中可以有很多个大模块，在一开始的枚举配置中，可以按照大模块来枚举。
```
enum API {
    //按照大模块划分
    case Home(HomeAPI) //首页模块
    case Subscribe(SubscribeAPI) //订阅模块
    case Breaks(BreaksAPI) //课间模块
}
```
每个大模块下面，还有若干个接口。我们除了基本的Moya配置文件外，又把每个大模块写一个配置文件，文件结构如下图
![](/Users/ChenYinjian/Desktop/URL技巧图/2.png)

这样划分之后，基础配置文件的变量设置可以写成下面这样，仅仅按照大模块进行划分。即使是一个庞大的项目，也很难出现大量的大模块，有效地控制单个文件内的代码规模。
```
var path: String {
   switch self {
   //大模块划分
   case .Home(let home): //首页模块
       return home.path
   case .Subscribe(let subscribe):
       return subscribe.path
   case .Breaks(let breaks):
       return breaks.path
   }
}
```
我们看看订阅模块里的配置
```
enum SubscribeAPI{
    case banner(position:Int,rtypes:String)
    case hotrank
    case new
    
}

extension SubscribeAPI{
    var path:String{
        switch self {
        case .banner:
            return "/subscribe/banner.do"
        case .hotrank:
            return "/subscribe/hotrank/list.do"
        case .new:
            return "/subscribe/new/list.do"
        }
    }
    
    var method:Moya.Method{
        switch self{
        case .banner,.hotrank,.new:
            return .get
        }
    }
    
    var task:Task{
        switch self {
        case .hotrank,.new:
            return .requestPlain
        case .banner(let position, let rtypes):
            return .requestParameters(parameters: ["position":position,"rtypes":rtypes], encoding: URLEncoding.queryString)
        }
        
    }
}
```
一般一个模块的接口数量，最多也就10几个或20几个，写起来，case的数量不至于多到令开发者感到不适。如果觉得太多还可以进一步划分。

通过上述配置之后，如果我们需要请求**订阅模块**里的**热门信息列表**，就可以写成下面这样
```
API.provider.request(.Subscribe(.hotrank), completion: {result in
            
})
```
相当于把原来的枚举分成了两层，逻辑层次看起更清晰一些，接口配置也比较易于管理。


