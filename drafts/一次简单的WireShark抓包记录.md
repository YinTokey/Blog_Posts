---
title: 一次简单的WireShark抓包记录
date: 2018-08-10 21:06:28
categories: 工具使用
---

在学习网络协议的时候，通过实践分析，更能帮助我们理解一些概念。
本篇是基于 Mr.peak 的 [Wireshark抓包iOS入门教程](http://mrpeak.cn/blog/wireshark/)，对某个知名应用iOS 客户端启动时的一个网络会话进行分析。具体的使用教程可以参照 Mr.peak 的文章。接下来就开始分析。
## TCP握手
App 使用了 HTTPS 协议，在进行 HTTPS 握手之前，传输层方面会先经历三次握手。TCP 连接建立后，TLS 层客户端发送 Client Hello，开始进入 TLS 的握手流程。看下面图的前4行。
![](https://ws3.sinaimg.cn/large/0069RVTdgy1fu4vgpu2a2j31kw0b80zj.jpg)
接着来看一下常说的 TCP 三次握手具体长什么样子。在具体分析之前，需要先过一下TCP首部的结构。
TCP 首部一共有20字节，其中 1字节(byte) = 8位(bit)。其结构如下图所示（图片来自维基百科）。
![](https://ws3.sinaimg.cn/large/0069RVTdgy1fu4vjibu10j31kw0gradr.jpg)
选取第一次握手，来看一下 TCP 首部的一些细节。 
![](https://ws4.sinaimg.cn/large/0069RVTdgy1fu4vl5ylhpj31go0ekjuw.jpg)

`源端口号`为 55185。
`目标端口号`为 443。
这个比较好理解，因为使用 HTTPS 通信，端口号默认采用443。第一次握手客户端向服务端发送 SYN，序列号 seq=0，Acknowledgment number =0。有些人可能感到疑惑:第一次握手不是SYN=1,ACK=0吗？需要注意一下，这里的Sequence number和 SYN 位是两个东西。常说的 SYN=1,ACK=0是 Control Flag 上的值，后面会说。Acknowledgment number =0是因为第一次握手，没有设置ACK，所以为0。Sequence number 是建立连接的时候由计算机生成的随机数作为其初始值，这里刚好为0，但并不是每次都为0. 

`Reserved`保留字段：主要为以后扩展时使用，长度为4位，一般设为0。从上面结构图可以看出前3位为0，最后一位 NS 标志位（Nonce Sum），用于实验目的。关于 NS 其实有一定争议：在《图解TCP/IP》中，把NS 归为Reserved，在维基百科中，则把NS 归为 Control Flag，即在维基百科中 Control Flag 有9位，在谢希仁的《计算机网络》第6版中，Reserved 字段长达6位。这部分划分争议性比较大，大家自行辩证地看待。

图中第一条高亮部分，即为 Flags，可以很明显地看到它后面注明了 SYN。一般来说 Reserved 右边为控制字段，由于上面说的争议性问题，所以我们换一种严谨一点的说法：NS位之后的8位，按照《图解TCP/IP》的说明，从左到右的标志依次为：

- `CWR`：Congesting window reduced，和后面的ECE都用于IP首都的ECE字段。ECE为1是，通知对方拥塞窗口即将变小。 
- `ECE`：ECN-Echo。
- `URG`：Urgent Flag 表示包中有需要紧急处理的数据，在后面的紧急指针中解释。 
- `ACK`：除了第一次握手，后面的ACK都应该为1。
- `PSH`：Push Flag，该位1的时候将收到的数据立刻传到上层应用协议，为0的时候，先缓存数据。
- `RST`：Reset Flag，该位为1时表示出现异常，要强制断开连接。（程序闪退，电脑没电等） 
- `SYN`：Synchronize flag，表示希望建立连接，并在序列表的字段进行序列号 Sequence number初始值设定。 
- `FIN`：为1时表示不再发送数据，希望断开连接。通信双方对对方的FIN包确认应答后，就可以断开连接了。主机收到FIN后不会马上回复一个FIN，而是可以等到缓存区中所有数据都发送成功自动删除后，再发FIN给对方。 

### 第一次握手
经过上面说明后，展开抓包的 Flags：
![](https://ws2.sinaimg.cn/large/0069RVTdgy1fu4vup8xfhj30vo0c4wgh.jpg)
可以看到本次，第一次握手，只有 SYN 位为1，其他位都为0（未设置状态）。

其他字段在后面握手中接着分析。
### 第二次握手
服务端发送给客户端 
![](https://ws2.sinaimg.cn/large/0069RVTdgy1fu4vxxzp9jj31820h2jv5.jpg)
可以看到这里就出现了常说的 SYN=1，ACK=1。

### 第三次握手
![](https://ws1.sinaimg.cn/large/0069RVTdgy1fu4w0h0tjbj30wy0hyadb.jpg)
第三次握手时，客户端回复给服务端 ACK = 1， SYN 此时为0， Sequence number为1。
三次握手的时候并没有发送具体的数据，因此分析的时候，重点需要放在 TCP 首部。

## TLS 握手
TCP 连接建立后，开始进入 TLS 握手阶段，也就是 HTTPS 的握手。关于 TLS 握手，可以参照上一篇[理论说明](https://juejin.im/post/5b5f1289e51d4519601aeeda)。

#### Client Hello
![](https://ws4.sinaimg.cn/large/0069RVTdgy1fu4w7sf2kmj313c0negqj.jpg)
客户端发送了Client Hello，其中 TLS 版本为1.2。其中里面包含了我们之前说的密码套件，会话 id，压缩方式，当前时间，随机数。还有很多 Extension 字段，可以携带更多信息，比如服务端名字，签名算法等。

#### Server Hello
服务端发给客户端密码套件，压缩方式等。
![](https://ws4.sinaimg.cn/large/0069RVTdgy1fu4way42y6j312k0k6jw1.jpg)

#### Certificates, CertificateRequest , ServerHellopDone
![](https://ws3.sinaimg.cn/large/0069RVTdgy1fu4wc7m5eij31bw0d2wib.jpg)
Certificates 中包含了 证书清单等内容,一个 Certificate就是一个证书。截图中至少可以看到两个证书，剩余的省略。 

#### ServerKeyExchange:
![](https://ws2.sinaimg.cn/large/0069RVTdgy1fu4wcgao4gj30ya0eytc8.jpg)
里面包含了公钥，签名等信息。
之后则是在传输层进行一些数据传送，直到客户端发送  ClientKeyExchange
#### ClientKeyExchange
![](https://ws3.sinaimg.cn/large/0069RVTdgy1fu4whw4bnej30yk08gmyv.jpg)
里面包含了公钥信息。还有一些价值不大的信息就不截出来了。

那么问题来了，之前说到 ClientKeyExchange 的时候，会发送经过加密的预备主密码，那么密文在哪里？当前在这里并没有看到，只看到用于加密的公钥。接着分析，极大可能是在下面两行的 Application Data 里发送的，我们可以看Application Data
![](https://ws2.sinaimg.cn/large/0069RVTdgy1fu4wjhirwfj31kw08lwh8.jpg)

在 TLS 的记录协议里面包含了客户端发给服务端的  Encrypted Application Data，根据记录协议的作用，这个密文很有可能就是经过加密的预备主密码。当然并不敢非常确定，如过不是，还请指出。

后面的 ChangeCipherSpec 里面并没有包含什么实质性内容，仅仅是告诉对方要变密码了。 

再后面双方则开始使用对称密码，对密文进行加密通信了。

## 最后
以上就是一次简单的抓包记录，对于前面理论学习的一次实践验证。最后想自行尝试的还是推荐看看 Mr.peak 写的 WireShark 使用教程。










