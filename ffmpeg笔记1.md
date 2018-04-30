## Xcode配置
最新ffmpeg版本是4.0，从[这里](https://github.com/kewlbear/FFmpeg-iOS-build-script)下载脚本，用于将ffmpeg编译成能在Xcode执行的静态库。根据文档，执行脚本。等待5~10分钟，编译完成后会在`FFmpeg-iOS-build-script`目录下面生成一个文件夹，该文件夹就是编译产物，可以将其拖入Xcode项目中使用。

这个系列着重于介绍ffmpeg的工作过程，关于ffmpeg的编译问题可自行研究。下面将直接使用编译好的静态库。

坑记录：
调用`av_register_all`的时候，出现报错，可以参考 https://www.jianshu.com/p/99ef8cb7cc25
一般是在 .m文件里调用av_register_all函数才会出现这个问题，如果在 .c文件里调用不会报错。

## 音视频转封装
(如果输入源来自网络而非本地文件，则需要调用 `avformat_network_init();` )

下面在Xcode中使用ffmpeg来实现视频文件的转封装，即格式转换。
`我们将采取两种输入方式：一种是本地视频文件，一种是在线视频。`
写一个iOS Demo，将转换后的文件输出到模拟器沙盒中保存。
以下例子根据官方 demo改造，将其应用到iOS中。 
下面对转封装的每一个步骤做详细解释。

**1.**先对一些需要用到的变量进行声明：
```
AVOutputFormat *ofmt = NULL;

//AVFormatContext是API层直接接触到的结构体，它会进行格式的封装与解封装。
AVFormatContext *ifmt_ctx = NULL, *ofmt_ctx = NULL;

AVPacket pkt;
char *in_filename, *out_filename;
int ret, i;
int stream_index = 0;
int *stream_mapping = NULL;
int stream_mapping_size = 0;
```
**注册**
转封装第一步是进行注册，即调用下面该函数。
```
av_register_all();
```
它的作用是初始化libavformat，初始化所有muxers（封装），demuxers（解封）,协议（流媒体）。其中libavformat是ffmpeg中处理音视频和字母封装和解封装的通用框架，是ffmpeg最重要的模块。关于ffmpeg的模块架构图，可以看下图

`图1`

libavformat作为其最重要的模块，可以看下它内部结构。

`图2`

注册完成之后，就可以执行打开操作，构建`AVFormatContext`

```
if ((ret = avformat_open_input(&ifmt_ctx, in_filename, 0, 0)) < 0) {
   fprintf(stderr, "Could not open input file '%s'", in_filename);
   goto end;
}
```
`avformat_open_input`函数，它会打开一个流，并且读取其头部。将`in_filename`挂载到`ifmt_ctx`结构体里，后续ffmpeg即可对`ifmt_ctx`进行操作。该流最后必须通过`avformat_close_input`函数进行关闭。它提供4个输入参数。

- 第一个参数是指针，指向用户提供的`AVFormatContext`，即上面的变量`ifmt_ctx`，指针可以为空。打开失败的时候，`ifmt_ctx`会被释放。
- 第二个参数`in_filename`为音视频流的URL，可以是本地文件，也可以来自网络。
- 第三个参数是文件格式，可以手动指定。如果不指定格式，那么它会自动检测。这里填写`0`，即不指定格式，让它自动检测。
- 第四个参数是一个字典，包含`AVFormatContext`和`demuxer-private`选项，这里可以暂时忽略它。

函数返回值为`0`表示打开成功，返回值为复数，表示打开失败。这里如果打开失败，会跳转到`end`部分去执行相应的操作。`end`部分稍后进行说明。




