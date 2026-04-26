# SpeakSure++ 前端多标签页 UI 改造方案

## 为什么要从单页改成多标签页

当前这个单页面控制台功能很全，但可用性上已经出现了几个明显问题：

- 同一时间展示的信息太多，视觉负担很重
- 用户需要频繁上下滚动，才能把“输入配置”“运行过程”“最终结果”串起来看
- 左侧控制面板和右侧分析面板长期争抢注意力
- 实时运行和静态回放混在一个页面里，认知成本偏高
- 原始事件、节点卡片、时间线、最终反馈都很有用，但并不应该在同一时刻同时成为主角

一句话总结：

现在的页面更像“开发调试控制台”，但实际使用场景里，用户更需要一个“分步骤查看、低负担浏览”的工作台。

## 核心目标

这次改造的目标不是单纯换个样式，而是解决三个体验问题：

- 降低视觉疲劳
- 减少来回拖动和长距离滚动
- 让不同阶段的信息各归其位

所以推荐从“一个很长的大页面”改成“顶部标签页 + 固定工作区”的结构。

## 推荐方向

把当前单页仪表盘改成一个带顶层标签页的工作台（workspace with tabs）。

这样做的好处是：

- 数据状态仍然共享，不需要拆成多个页面路由
- 用户只在当前任务相关的信息里做决策
- 可以大幅减少同屏信息密度
- 更适合演示、答辩和课程作业展示

## 必须遵守的交互原则

如果目标是减少疲劳感和拖动成本，那么多标签页版本需要遵守以下规则：

- 页面整体要有固定骨架：页头、标签栏、内容区三层稳定存在
- 内容加载后不能把整页越撑越高，应该以“内部滚动”为主
- 一个标签页只解决一类核心问题，不混放配置、运行、结果、调试
- 关键信息要持续可见，例如当前模式、场景、运行状态
- 实时执行时，要让“当前最重要的信息”一眼可见

最大的体验提升，不一定来自更炫的视觉风格，而是来自信息层级更清晰。

## 最推荐的顶层结构

建议使用四个一级标签页：

1. `Run`
2. `Pipeline`
3. `Results`
4. `Debug`

这比把每个小区域都做成单独标签更合理，因为它是按“用户意图”分组，而不是按“技术模块”分组。

## 四个标签页分别做什么

### 1. Run

用途：发起实时分析，或者加载静态回放。

建议包含：

- 模式切换：`Live` / `Replay`
- 音频上传
- 场景选择
- transcript override
- 回放文件路径输入
- 启动按钮
- 当前会话摘要卡片

这个标签页应该是唯一负责“输入和启动”的地方。

它的气质应该更像一个清晰的配置页，而不是运行监控页。

### 2. Pipeline

用途：查看执行进度，理解当前流程跑到了哪个 node。

建议包含：

- 顶部进度轨道 / stepper
- 节点卡片网格或节点列表
- 被选中节点的详细信息面板
- 时间线
- 回放模式下的播放控制

推荐布局：

- 顶部：progress rail
- 左侧：node list / node cards
- 右侧：selected node detail
- 底部：replay controls 或 timeline

这个标签页是整个系统的“过程理解页面”。

它也应该是唯一一个在运行过程中频繁刷新的标签页。

### 3. Results

用途：聚焦最终结果，而不是运行细节。

建议包含：

- overall score
- level
- dominant causes
- summary
- segment feedback cards
- rewrite suggestions
- practice steps

这个标签页应该让用户一进来就能看到最终结论，而不需要从节点卡片和事件流里自己拼装答案。

### 4. Debug

用途：保留工程视角的信息，不污染主体验。

建议包含：

- raw event payload
- rendered result JSON
- runtime metadata
- warnings / errors
- 后续如有需要，也可以加 prompt dump

这个标签页主要用于：

- 开发排查
- 演示时解释底层过程
- 出错时快速定位问题

它应该存在，但不应该主导默认体验。

## 推荐的操作流

为了减少无意义滚动，建议采用下面这种简单的使用路径：

1. 在 `Run` 里配置并启动任务
2. 在 `Pipeline` 里观察执行过程
3. 在 `Results` 里看最终输出
4. 只有需要排查时才进入 `Debug`

这条路径非常适合老师、队友、评审或演示观众理解整个系统。

## Desktop 端推荐布局

整体结构建议如下：

```text
Header
Top Tabs

Tab Content Area
```

并且遵守这些布局规则：

- 应用整体高度尽量贴合 viewport
- header 和 tab bar 保持稳定，不随内容高度波动
- 每个 tab 内部使用独立滚动容器
- 同一行里的卡片尽量等高
- 不要把 auto-height 内容和 fixed-height 内容硬塞进同一行造成错位

### Run 标签页

```text
-----------------------------------------
| Input Form         | Session Summary   |
| Input Form         | Session Summary   |
-----------------------------------------
```

### Pipeline 标签页

```text
-----------------------------------------
| Progress Rail                          |
-----------------------------------------
| Node List / Cards  | Selected Detail   |
| Node List / Cards  | Selected Detail   |
-----------------------------------------
| Replay Controls / Timeline             |
-----------------------------------------
```

### Results 标签页

```text
-----------------------------------------
| Score | Level | Warnings              |
-----------------------------------------
| Summary                               |
-----------------------------------------
| Segment Feedback Cards                |
-----------------------------------------
```

### Debug 标签页

```text
-----------------------------------------
| Raw JSON           | Raw Event Payload |
| Raw JSON           | Raw Event Payload |
-----------------------------------------
```

## Mobile 端推荐布局

在移动端，多标签页会更重要。

建议：

- tab bar 固定在 header 下方
- 一次只展示一个主区域
- 内容纵向堆叠，不要强行双栏
- 重面板一次只出现一个

`Pipeline` 在移动端可以改成：

- progress rail
- selected node card
- node list
- replay controls

这样会比强行保留左右分栏稳定很多。

## 默认视图里不要再堆在一起的内容

默认主视图不应该再同时塞进以下所有内容：

- raw event payload
- full JSON
- pipeline cards
- replay controls
- final digest

这些内容都值得保留，但不值得同时出现。

## 推荐的组件拆分方式

如果准备正式重构当前前端，建议把现在这个很大的 `App.tsx` 拆成下面这些组件：

- `components/layout/AppShell.tsx`
- `components/navigation/TopTabs.tsx`
- `components/run/RunPanel.tsx`
- `components/pipeline/PipelineTab.tsx`
- `components/pipeline/NodeGrid.tsx`
- `components/pipeline/NodeDetailPanel.tsx`
- `components/pipeline/ReplayControls.tsx`
- `components/results/ResultsTab.tsx`
- `components/results/ScoreSummary.tsx`
- `components/results/FeedbackList.tsx`
- `components/debug/DebugTab.tsx`

这样后面做样式修复、移动端适配、单独优化某个标签页时会轻松很多。

## 状态管理建议

建议继续保留“一个共享的分析会话状态”，然后在不同标签页里渲染不同切片。

推荐保留的共享状态包括：

- `mode`
- `job`
- `events`
- `finalState`
- `activeNode`
- `activePayload`
- `replayCursor`
- `isReplayPlaying`

不要让每个 tab 自己维护一份数据副本，不然状态会越来越难对齐。

## 建议的分阶段改造顺序

### Phase 1：先把页面切开

先做低风险重构：

- 加入顶层 tabs
- 把左侧控制面板移到 `Run`
- 把进度、节点卡片、时间线移到 `Pipeline`
- 把得分、总结、反馈移到 `Results`
- 把 raw JSON 和 raw payload 移到 `Debug`

这一阶段不用大改视觉，只需要先把信息层级理顺。

### Phase 2：再拆组件和精修布局

- 拆分 `App.tsx`
- 简化每个 tab 的内部结构
- 删除重复卡片
- 让重要信息优先展示

### Phase 3：增强体验

- 增加 sticky tab bar
- 记住用户上次选中的 tab
- 增加快捷键切换
- 视情况增加二级 tabs

## 防止变形和重叠的检查清单

这部分非常关键，因为当前单页 UI 的核心问题之一就是：内容一加载就会撑开、重排、重叠。

实现多标签页时，建议强制遵守以下规则：

- 每个主 tab 内容区都给出稳定的最小高度或视口高度约束
- 外层卡片统一 `overflow-hidden`
- 真正滚动的区域放在内层，用 `overflow-auto`
- 长文本要截断、折叠或限制高度，不能直接把兄弟卡片撑变形
- 预览区、结果区、调试区尽量分 tab，不再横向混排
- 空状态也要预留固定空间，不要让“有内容”和“无内容”高度差太大
- 文件上传、回放信息、JSON 预览都不能改变整个页面骨架高度

## 为什么这个方案比继续修补单页更值得做

如果继续在现有单页上打补丁，后面大概率还会反复遇到：

- 某个模块加一点内容就又开始变形
- 桌面端还好，移动端直接失控
- 演示时来回找信息，体验很割裂
- 代码继续集中在一个超大的 `App.tsx` 里

而多标签页方案的优势是：

- 信息分层天然更清楚
- 每个 tab 更容易做固定高度和内部滚动
- 更适合答辩展示流程
- 后续也更容易拆组件维护

## 最终建议

如果现在要做一次“投入不大但体验提升明显”的改造，最佳方案就是：

- `Run`
- `Pipeline`
- `Results`
- `Debug`

先把这四个顶层标签页落地，再逐步做视觉打磨。

不要一开始就全面重画所有卡片。

最优先的，是先把“用户不再需要来回拖动、不再被一整页信息压住”这个问题解决掉。
