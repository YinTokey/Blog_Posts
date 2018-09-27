
# 从Runtime源码探究OC对象中的引用计数
本篇是来自 Runtime源码的 objc4-723 的部分总结，探究和引用计数相关的方法的底层实现思路。

这里涉及到了 `retain`，`isa`，`sideTable`，`release`等相关的方法和结构，接下来开始分析这些方法的底层原理。

### 1. retain 操作
我们知道 retain 有两个作用：
1.对象引用计数加一
2.返回实例对象本身。

类对象也有 retain 方法，它会直接直接返回self,不做其他操作。
```
+(id) retain
{
    return self;
}
```

实例对象，调用 retain，则会有以下调用
```
retain -> _objc_rootRetain(self) -> rootRetain() -> rootRetain(false, false)
```

也就是说实例对象的 retain 操作，最终可以定位到`objc_object::rootRetain(bool tryRetain, bool handleOverflow)`这个方法中。

`rootRetain`方法内部比较复杂，在理解这个方法之前，需要先了解一下引用计数存储位置，以及`isa`和`sideTable`。

### 2. 引用计数的存储位置
#### 2.1 isa
arm64 下面的 isa 结构如下:

它是一个共用体。
```
union isa_t 
{
    isa_t() { }
    isa_t(uintptr_t value) : bits(value) { }
    Class cls; //实例对象，cls指向类对象；类对象cls指向元类对象。64位设备占用8字节
    uintptr_t bits;
    
    struct {
        uintptr_t nonpointer        : 1; //是否指针优化
        uintptr_t has_assoc         : 1; //是否设置了关联（objc_setAssociatedObject）
        uintptr_t has_cxx_dtor      : 1; //是否设置了析构函数，如果没有，释放对象更快
        uintptr_t shiftcls          : 33;// 存储class  meta-class对象内存地址
        uintptr_t magic             : 6; //在调试时分辨对象是否已经完成初始化
        uintptr_t weakly_referenced : 1; //是否被弱引用指向过（_weak声明）没有释放更快
        uintptr_t deallocating      : 1; //是否正在释放
        uintptr_t has_sidetable_rc  : 1; //当引用计数大于10，改值为1，然后引用计数存储在SideTable中
        uintptr_t extra_rc          : 19; //存储的值时对象引用计数值减1，比如对象引用计数为10，该值就为9（使用二进制表示）
#       define RC_ONE   (1ULL<<45)
#       define RC_HALF  (1ULL<<18)
    };
}
```
从 isa 内部结构体已经可以很明显地告诉我们`对象引用计数存在哪里`。

引用计数可以存储在两个地方，一个是 isa 结构体内的 extra_rc，另一个是 sideTable 的属性里。

其中对于 extra_rc 执行了这一句让引用计数加1
```
newisa.bits = addc(newisa.bits, RC_ONE, 0, &carry);  // extra_rc++
```

对于 `sideTable`，主要涉及两个方法`sidetable_tryRetain()`，`sidetable_retain()`

#### 2.2 sideTable
在解释一堆概念之前，先简单了解一下 sideTable 结构。（这里删减一写相对不重要的东西）
这里只做简单介绍，后续如果有需要再用其他篇幅去详细介绍，或者可自行查看源代码。
```
struct SideTable {
    spinlock_t slock;
    RefcountMap refcnts;
    weak_table_t weak_table;
    void lock() { slock.lock(); }
    void unlock() { slock.unlock(); }
    void forceReset() { slock.forceReset(); }
    // Address-ordered lock discipline for a pair of side tables.
    static void lockTwo(SideTable *lock1, SideTable *lock2);
    static void unlockTwo(SideTable *lock1, SideTable *lock2);
};
```
其中 refcnts 就是存储了引用计数，是 RefcountMap 类型的散列表，而 weak_table 是弱引用表。

`sidetable_tryRetain()`的实现如下:

```
bool
objc_object::sidetable_tryRetain()
{
    SideTable& table = SideTables()[this];
    bool result = true;
    RefcountMap::iterator it = table.refcnts.find(this);
    if (it == table.refcnts.end()) {
        table.refcnts[this] = SIDE_TABLE_RC_ONE;
    } else if (it->second & SIDE_TABLE_DEALLOCATING) {
        result = false;
    } else if (! (it->second & SIDE_TABLE_RC_PINNED)) {
        it->second += SIDE_TABLE_RC_ONE;
    }
    
    return result;
}
```
获取对象的 sideTable，通过一些操作，让它 refcnts 里面存储的引用计数加1,如果操作成功会返回 true。

```
id
objc_object::sidetable_retain()
{
    SideTable& table = SideTables()[this];
    
    table.lock();
    size_t& refcntStorage = table.refcnts[this];
    if (! (refcntStorage & SIDE_TABLE_RC_PINNED)) {
        refcntStorage += SIDE_TABLE_RC_ONE;
    }
    table.unlock();
    return (id)this;
}
```
sidetable_retain 也是对 refcnts 里面存储的引用计数操作，只是它返回对象本身。为了保证线程安全，还加了自旋锁。


#### 2.3 extra_rc 引用计数溢出
在 rootRetain 里面有这么两段关键段代码

```
if (slowpath(!newisa.nonpointer)) {
    ClearExclusive(&isa.bits);
    if (!tryRetain && sideTableLocked) sidetable_unlock();
    if (tryRetain) return sidetable_tryRetain() ? (id)this : nil;
    else return sidetable_retain();
}
```
当 isa 没有优化过，我们可以看到出现的都是上面介绍的两个sideTable 的方法。这里的处理就是把引用计数存储在 sideTable里面。

那么当 isa 被优化过，即 nonpointer 为 true 的时候，它又怎么存储引用计数呢？看下面的代码

```
newisa.bits = addc(newisa.bits, RC_ONE, 0, &carry);  // extra_rc++
if (slowpath(carry)) {
  // newisa.extra_rc++ overflowed
  if (!handleOverflow) {
      ClearExclusive(&isa.bits);
      return rootRetain_overflow(tryRetain);
  }
  // Leave half of the retain counts inline and 
  // prepare to copy the other half to the side table.
  if (!tryRetain && !sideTableLocked) sidetable_lock();
  sideTableLocked = true;
  transcribeToSideTable = true;
  newisa.extra_rc = RC_HALF;
  newisa.has_sidetable_rc = true;
}
if (slowpath(transcribeToSideTable)) {
   // Copy the other half of the retain counts to the side table.
   sidetable_addExtraRC_nolock(RC_HALF);
}
```
引用计数增加操作，优先增加 isa 的 extra_rc，当溢出的时候，引用计数一半留在 extra_rc，另一边拷贝到 SideTable中，并把newisa.has_sidetable_rc 设为 true。 这点在很多博客中都没有说明。



#### 2.4 小结
总结一下，引用计数可以存储在两个地方，一个是 isa 的extra_rc，一个是这个对象的 sideTable 里面的 refcnts 散列表。 使用 retain 操作进行引用计数加一时，会先判断 isa 指针是否优化过，如果没有优化过，那就统一存在 sideTable 的refcnts 里面。如果 isa 优化过，优先加在 extra_rc上，当extra_rc 溢出时，它存储的引用计数减半，另一半拷贝到了SideTable 的 refcnts 里面。

### 3. retainCount 获取对象引用计数
在底层调用了 `rootRetainCount()`方法
```
inline uintptr_t 
objc_object::rootRetainCount()
{
    if (isTaggedPointer()) return (uintptr_t)this;

    sidetable_lock();
    isa_t bits = LoadExclusive(&isa.bits);
    ClearExclusive(&isa.bits);
    if (bits.nonpointer) {
        uintptr_t rc = 1 + bits.extra_rc;
        if (bits.has_sidetable_rc) {
            rc += sidetable_getExtraRC_nolock();
        }
        sidetable_unlock();
        return rc;
    }

    sidetable_unlock();
    return sidetable_retainCount();
}
```
一开始判断，如果是 TaggaedPointer ,那就没必要继续处理了。
我们从前面知道引用计数可以存储在两个地方。
如果是优化过的 isa，通过`uintptr_t rc = 1 + bits.extra_rc;`获取引用计数，前面也有提到过 extra_rc 的值为引用计数减1,所以这里执行了加1操作。然后判断如果has_sidetable_rc为true，那么还有一部分引用计数存储在sideTable 里面，通过
```
rc += sidetable_getExtraRC_nolock();
```
获取引用计数并累加起来,最后返回结果。
如果 isa 没有优化过，那么不执行上面流程，直接通过`sidetable_retainCount()`从 sideTable 里获取引用计数。

从这里可以得到一个关键信息，如果 isa 只有开启了指针优化，才会把引用计数存在 extra_rc 里面，否则都存在了 sideTable 中。

### 4. release 引用计数减一

release 会调用 rootRelease，它的代码非常长，需要分几个部分来看。前面已经看了 retain 操作的细节，那么 release 操作，就要反向分析，免不了要根据 isa 是否优化，分别考虑 sideTable 和 extra_rc 的引用计数减一操作。

#### 4.1 操作细节
先看`rootRelease`的前面部分
```
    if (isTaggedPointer()) return false;

    bool sideTableLocked = false;

    isa_t oldisa;
    isa_t newisa;

 retry:
    do {
        oldisa = LoadExclusive(&isa.bits);
        newisa = oldisa;
        if (slowpath(!newisa.nonpointer)) {
            ClearExclusive(&isa.bits);
            if (sideTableLocked) sidetable_unlock();
            return sidetable_release(performDealloc);
        }
        // don't check newisa.fast_rr; we already called any RR overrides
        uintptr_t carry;
        newisa.bits = subc(newisa.bits, RC_ONE, 0, &carry);  // extra_rc--
        if (slowpath(carry)) {
            // don't ClearExclusive()
            goto underflow;
        }
    } while (slowpath(!StoreReleaseExclusive(&isa.bits, 
                                             oldisa.bits, newisa.bits)));

    if (slowpath(sideTableLocked)) sidetable_unlock();
    return false;
```
先判断是否为 Tagged pointer，如果是就不需要进行下面的处理了。

接下来根据 isa 是否优化过，分别处理。

根据上面我们知道 isa 如果没有优化过，引用计数都存在sideTable 里面，所以最后会调用`sidetable_release`，在该方法内对 sideTable 里的引用计数减一操作，如果引用计数为0了，会使用`objc_msgSend`发送`SEL_dealloc`,进行对象销毁释放。

如果 isa 优化过，那么就先执行
```
newisa.bits = subc(newisa.bits, RC_ONE, 0, &carry);  // extra_rc--
```
对 extra_rc 里的引用计数减一。接下来的操作就比较有意思了，我们前面说过，extra_rc溢出的时候，它的引用计数会减半，另一半拷贝到sideTable里面。那么反过来，当extra_rc被减到0的时候，怎么办？它会跳到`underflow`去执行。

`underflow`里面存在存在着很多复杂的细节，从大致上说一下它的逻辑：

从sideTable 里拿一些引用计数，拿多少个引用计数，目前笔者不是非常确定，它的代码和注释是这么写的
```
// Try to remove some retain counts from the side table.        
size_t borrowed = sidetable_subExtraRC_nolock(RC_HALF);
```
RC_HALF 为e xtra_rc 总位数的一半。这里涉及一些二进制位运算，可自行了解。
如果能从 sideTable 里拿到引用计数，那么引用计数减一，赋值给extra_rc

如果不能从 sideTable 里拿出引用计数，那么说明这个对象的引用计数归零了，和上面`sideTable_release`内部一样，调用了
```
((void(*)(objc_object *, SEL))objc_msgSend)(this, SEL_dealloc);
```
进行对象释放操作。

#### 4.2 小结
对象release发生了什么？

1. 如果是Tagged pointer不干啥事。
2. 如果isa没有优化过，那么它的引用计数都存储在sideTable里面。调用`sidetable_release()`，把里面refcnts散列表存储的引用计数减一，如果引用计数变成零了，调用dealloc释放对象。
3. 如果isa被优化过，先对extra_rc减一，如果extra_rc归零了，从sideTable里面拿一些引用计数，减一，赋值给extra_rc。如果sideTable也没有引用计数了，说明整个对象引用计数为0了，调用dealloc释放对象。


### 5. autoRelease 将对象加入自动释放池
autoRelease 的底层会调用 rootAutorelease。
```
inline id 
objc_object::rootAutorelease()
{
    if (isTaggedPointer()) return (id)this;
    if (prepareOptimizedReturn(ReturnAtPlus1)) return (id)this;

    return rootAutorelease2();
}
```
不考虑前面两个优化处理的话， 最终会调用
```
AutoreleasePoolPage::autorelease((id)this);
```
通过这个方式向 autoReleasePool 添加对象的地址。因为篇幅有限，这里不打算介绍AutoreleasePoolPage,本篇更多的是对操作流程做一些总结。想了解更多细节，建议参考这两个：[黑幕背后的Autorelease](http://blog.sunnyxx.com/2014/10/15/behind-autorelease/)，[Objective-C Autorelease Pool 的实现原理](http://blog.leichunfeng.com/blog/2015/05/31/objective-c-autorelease-pool-implementation-principle/)
```
static inline id *autoreleaseFast(id obj)
{
   AutoreleasePoolPage *page = hotPage();
   if (page && !page->full()) {
       return page->add(obj);
   } else if (page) {
       return autoreleaseFullPage(obj, page);
   } else {
       return autoreleaseNoPage(obj);
   }
}
```
对象地址存在 AutoreleasePoolPage 里面，没个AutoreleasePoolPage 直接的连接方式是双向链表，hotPage为最新的AutoreleasePoolPage。

总结一下，这里面做什么事：

1. 获取最新的 AutoreleasePoolPage，如果有 page 且没满，就把对象地址加进去。加在 page->next 的位置。
2. 如果有 page,但是满了，根据 child 指针找到下一个 page，把对象地址加到下个 page 里面。
3. 如果没有下一个 page,就创建新的 page，且设为 hotPage，那么下次查找就找到这个新 page，不需要从头再找了。然后对象地址加入到新 page 里面。
4. 如果连第一个 page 都没有，那么创建第一个 page，设为hotPage，对象地址加进去。

`autoReleasePool如何释放的？`

这里不做详细介绍了，简单总结一下：
从整体上来说 autoReleasePool 是一个栈结构，遵循后进先出原则，释放时就是一个出栈的操作。

1. 找到 hotpage，按照出栈的顺序调用 objc_release 释放
2. 当前page释放完了，通过 parent 指针找到前一个 page,继续操作。空的 page 会调用 page->kill() 清理掉
3. 一直处理，直到遇到边界，释放结束




