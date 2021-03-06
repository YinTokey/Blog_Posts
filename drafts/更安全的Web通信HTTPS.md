---
title: 更安全的Web通信HTTPS
date: 2018-07-30 21:20:38
categories: 计算机网络
---

# 更安全的Web通信HTTPS
## 1. HTTP协议存在的问题
阅读本篇需要对HTTP协议有最基本的了解。
借用《图解密码技术》里的图片，我们以如下一个购物场景开始介绍：
![](https://ws3.sinaimg.cn/large/006tNc79gy1ftpnmfdxxvj30vi0hggnz.jpg)
在网购过程中，如果使用纯粹的HTTP协议，那么用户的账号密码，信用卡，银行卡信息都将在信息传输过程中直接裸奔。从例子中我们可以看到信用卡信息直接被明文传输了。除了明文传输之外，还存在着以下两个问题:
1. 无法验证通信方身份的真实性，即无法确认对方是否是真正的商家。
2. 无法确认信息是否被篡改，即无法确认传输过程信用卡信息和收货地址是否被篡改过。

常规情况下，可以对通信的内容进行加密，来避免明文传输的问题。但是单靠这点，无法解决信息完整性和认证问题。为了解决这些问题，需要对通信进行加密。也就引入了 HTTPS 。

## 2. HTTPS结构
### 2.1 HTTPS与HTTP
HTTPS 本身并不是一个协议，它使用 SSL/TSL 作为对通信加密的协议，承载 HTTP ，将两种协议叠加，来实现对 HTTP 通信进行加密的目的。二者的关系为
**HTTP+加密+认证+完整性保护=HTTPS**
单纯从层次上对比二者的差异为：
![](https://ws3.sinaimg.cn/large/006tNc79gy1ftpoig6c8qj30m20aetab.jpg)
即在 HTTP 协议下又加了一层 SSL，计算机网络通信过程的信息流动方向是发送方信息由上到下进行包装，然后接收方将信息由下到上进行解包。上述的购物场景，如果使用了 SSL/TSL 承载 HTTP，那么通信的流程将会变化成如下图：
![](https://ws3.sinaimg.cn/large/006tNc79gy1ftpomozx1jj30wq0j00xl.jpg)
无论是客户端，还是服务端，消息发送的时候，都是从上往下，经过了 SSL/TLS 加密，然后接收的时候再由下往上解密。

看到这里你可能对流程已经有所理解，但又存在疑惑： SSL/TSL 是什么东西？

### 2.2 SSL/TLS
SSL（Secure Socket Layer），称为安全套接层，是1994年网景公司设计的一种安全协议，用于解决了网络通信安全和数据完整性问题。第一个版本的TLS（Transport Layer Security） 是在 SSL3.0基础上设计的，可以理解为 SSL 3.1。后续的 TLS 版本又加入了更多特性，可以把它理解为是 SSL 的升级版。

#### 2.1 SSL/TLS 位于哪一层？
目前普遍的说法是 SSL/TLS 无法确切地被划分到 OSI 或者 TCP/IP 的具体某一层。从逻辑上来讲，SSL/TLS 的加密功能正好能和 OSI的表示层相对应，但是一些应用程序会把它当做传输层。所以比较保守的说法是**SSL/TLS介于传输层和应用层之间**。
#### 2.2 TLS结构简介
SSL/TLS 不仅可以承载 HTTP，也可以承载其他应用层协议。
![](https://ws4.sinaimg.cn/large/006tKfTcgy1fts6bzk32dj30so096400.jpg)

协议本身可以分成两层，上层是握手协议，下层是记录协议。如下图：
![](https://ws1.sinaimg.cn/large/006tKfTcgy1fts6c0ukztj30ng0dwabu.jpg)

上层又分成了4个子协议，其中第一个握手协议是最重要的，它的作用是确认双方使用的密码套件，双方共享密钥，基于证书的认证操作。
其他三个子协议的作用分别是：

- 密码规则更变协议：通知对方要交换密码了
- 警告协议：把错误信息传给对方
- 应用数据协议：将承载的数据传达给对方

记录协议位于下层，它的作用是使用对称加密的方式对消息进行加密通信，过程可以再进一步细分为：
1. 将消息分割成多个片段，每个片段进行压缩。
2. 压缩后的片段，加上消息认证码，用于保证完整性，并进行数据认证。消息认证码的密钥在握手结束后可以生成，下面会介绍。
3. 上面生成的东西，通过对称加密，加密使用CBC模式，而CBC模式的初始化向量，以及对称加密的密钥，都可以在握手完成，通过主密码生成，下面会介绍。
4. 经过上面加密之后，再加上一个报头，就是最后的报文数据了。这个报头由数据类型，版本号，压缩后的长度组成。其中数据类型是上层握手协议的4个子协议之一。
![](https://ws4.sinaimg.cn/large/006tNc79gy1fts78l1nncj30j30dpgmw.jpg)
## HTTPS握手过程
我们知道 HTTP 是基于 TCP 来完成的，TCP有握手过程，HTTPS同样也有握手过程。当我们谈论 HTTPS的时候，其实更侧重的是谈论 SSL。

默认情况下 HTTP 通信，客户端会打开一条到服务器端口80的连接。而 HTTPS 则会打开一条到服务器端口443的连接。 TCP 连接建立后，会初始化 SSL，沟通加密参数，交换密钥，完成握手过程后，SSL 初始化完成。然后就可以加密通信了。

我们在谈论HTTPS握手过程，其实就是SSL的握手过程。这个握手过程分成4个部分。下面将详细地解析这4个部分。

![](https://ws3.sinaimg.cn/large/006tKfTcgy1fts5daqtuhj30sy0z8djo.jpg)

#### 一： 客户端 -> 服务端
客户端向服务端发送Client Hello，告诉服务端它能理解的密码套件（RSA/3DES等），压缩方式，会话id,当前时间，SSL/TLS 协议的可用版本，客户端随机数。

#### 二： 服务端 -> 客户端
1.服务端向客户端发送Server Hello。
2.服务端发送Certificate，以及把证书清单发给客户端,里面包含了公开密钥的证书。
3.Certificate不足以满足需求的时候，还会发送 ServerKeyExchange，告诉客户端使用这些信息来进行密钥交换。
4.服务端向客户端发送CertificateRequest消息，发送了服务端能理解的证书类型清单和能理解的的认证机构名称清单。
5.ServerHelloDone

#### 三： 客户端 -> 服务端
1.如果收到 CertificateRequest，会向服务端发送Certificate消息，以及发送自己的证书。
2.发送 ClientKeyExchange 以及经过加密的预备主密码（随机数）。这个报文是经过加密的，加密的公钥就是服务端发送Certificate时，发给客户端的公钥。
3.如果收到 CertificateRequest，还会发送 certificateVerify消息，告诉服务端它就时客户端证书的持有者本人。
4.客户端发送changeCipherSpec消息，告诉服务端要切换密码了（实际上这个是密码规则更变协议里的东西）。服务端收到这个消息后，双方同时切换密码
5.客户端发送 Finished （这时候客户端使用已经切换后的密码套件来发送）

#### 四： 服务端 -> 客户端
1.服务端发送 changeCipherSpec，告诉客户度要切换密码了
2.服务端发送 Finished 表示结束。 然后就切换到了应用数据协议。之后双方使用应用数据协议和TLS记录协议来进行密码通信。

#### 握手过程一共完成的工作有：
1.客户端获得服务端的合法公钥（第二部分第二点），完成服务端认证。
2.服务端获得客户端的合法公钥（第三部分第一点），完成客户端认证。
3.双端生成通信中对称加密的共享密钥。
4.双端生成消息认证中的共享密钥。

HTTPS 采用了**混合加密机制**。在握手环节使用公钥加密方式。通信建立后，交换报文时，使用共享密钥加密，也就是上面第3和第4点。对称加密会比非对称加密快很多，提高通信过程的效率。共享密钥的生成过程，可以从这张图中去理解。

![](https://ws3.sinaimg.cn/large/006tKfTcgy1fts5hhyxjpj30we0jsqqj.jpg)

客户端和服务端可以拥有一样的预备主密码，在握手的开始阶段，双方协商了共同使用什么密码套件。预备主密码同时使用由密码套件中两个单向散列函数（MD5和SHA-1）组合的伪随机数生成器，生成主密码（客户端的预备主密码也是使用伪随机数生成）。两端都会根据这个一样的预备主密码，计算出一样的主密码。然后再由一样的主密码，生成下面三个：

- 用于对称加密的密钥
- 消息认证码的密钥
- 对称密码的CBC模式中使用的初始化向量

每一样都有两份，即客户端发往服务端，和服务端发往客户端。所以主密码一共可以生成6种信息。

![](https://ws2.sinaimg.cn/large/006tKfTcgy1fts5i5gjbuj30i20djta0.jpg)

以上就是HTTPS握手过程的详细解析。握手建立完成后，客户端和服务端有拥有对称加密的密钥，那么就可以使用这个密钥对通信内容进行加密了。

## HTTPS相对于HTTP有什么不一样？
总结一下，HTTPS多做了什么，它和HTTP有什么不一样。

- HTTP是明文传输，HTTPS是加密传输
- HTTPS需要申请证书，有一定成本
- HTTP使用80端口，HTTPS使用443端口
- HTTP没有身份认证，HTTPS有身份认证
- HTTP报文完整性无法验证，可能被篡改。HTTPS可以验证。

## 参考资料
[图解密码技术](https://book.douban.com/subject/26265544/)
[图解HTTP](https://book.douban.com/subject/25863515/)
[HTTP权威指南](https://book.douban.com/subject/10746113/)
[Transport Layer Security](https://en.wikipedia.org/wiki/Transport_Layer_Security)









