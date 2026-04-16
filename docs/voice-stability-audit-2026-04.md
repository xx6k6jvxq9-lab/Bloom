# 语音稳定性盘点

## 当前结论

当前语音能力已经有完整产品形态，但还不算稳定服务链。

更准确地说：

1. 语音消息：可用，但稳定性依赖浏览器本地录音和本地识别
2. 语音输入按钮：可用，但强依赖浏览器 `SpeechRecognition`
3. 语音通话：能跑，但最不稳，依赖浏览器持续识别重启

一句话判断：

现在的语音链已经能展示、能发送、能触发 AI 回复，但本质仍是“浏览器原生能力拼起来的可用版”，不是“线上稳定承重版”。

## 当前真实链路

### 1. 语音消息链

入口：

- `src/features/chat-session/useAudioMessageRecorder.ts`
- `src/features/chat-session/ChatSessionScreen.tsx`
- `src/features/chat-session/GroupChatSessionScreen.tsx`
- `src/features/music-together/TogetherChatPanel.tsx`

链路：

1. `getUserMedia` 取麦克风
2. `MediaRecorder` 录音
3. 本地转成 wav
4. 如果浏览器支持 `SpeechRecognition`，顺手拿一份本地转文字
5. 通过 `saveUploadedBlob` 存成 `audioUrl`
6. 消息里写入 `audioUrl / audioMimeType / audioTranscript`
7. Runtime 发给模型时：
   - 有转文字就用 `[sent a voice message; transcript: ...]`
   - 没转文字就只发 `[sent a voice message]`

判断：

这条链的 UI 闭环已经完整，但“转文字是否存在、是否准确”完全取决于浏览器本地识别。

### 2. 语音输入按钮链

入口：

- `src/features/chat-session/useSpeechRecognitionInput.ts`
- `src/features/chat-session/ChatSessionScreen.tsx`

链路：

1. 直接调用 `webkitSpeechRecognition / SpeechRecognition`
2. 单次识别成功后，把 transcript 当普通文本发出去

判断：

这条链最轻，但也最依赖浏览器支持。没有服务端兜底时，不支持的浏览器就是直接不可用。

### 3. 语音通话链

入口：

- `src/features/chat-session/ChatSessionScreen.tsx`
- `src/features/chat-runtime/useDirectChatRuntime.ts`

链路：

1. 开始通话后启动浏览器连续语音识别
2. `finalTranscript` 进入 `voiceCallHistory`
3. 再触发 `handleVoiceCallAIResponse`
4. 结束通话时把 `voiceCallHistory` 整理成记录

判断：

这是当前最脆弱的一条。因为它不是录音上传后异步处理，而是要求浏览器一直在线、一直识别、还要在 `onerror / onend` 后不断重启。

## 现在最不稳的点

1. 底层依赖浏览器原生识别
   - `SpeechRecognition` 并不是所有手机浏览器都稳定支持
   - Android 原生浏览器、部分国产浏览器、Safari 的表现会明显不一致

2. 录音和转写不是同一条稳定链
   - 录音可成功，不代表转文字一定成功
   - 所以语音消息经常会出现“有音频、没 transcript”

3. 语音通话依赖持续重启识别
   - `onerror` 和 `onend` 后会尝试重启
   - 这对长时间通话特别敏感，容易出现中断、停听、识别断流

4. OpenAI 兼容链对音频输入更苛刻
   - `src/services/ai/runtimeClient.ts` 里，OpenAI 兼容消息要求音频是 data URL
   - 这意味着不同模型/不同运行时对音频输入的稳定性要求并不完全一致

5. 用户感知和真实状态可能不完全一致
   - UI 可以显示“正在录音/正在通话”
   - 但底层识别未必仍在持续工作

## 当前阶段判断

如果按阶段说，语音这条线现在属于：

1. 产品闭环已成
2. 工程稳定性未成
3. 仍然是浏览器方案优先，不是服务方案优先

通俗一点：

现在已经不是“没有语音功能”，而是“语音已经能用，但还没到可以把稳定性承诺给所有手机浏览器的程度”。

## 下一步建议

### P1 继续保留当前方案时

适合目标：先维持可用，不立刻上服务端

建议：

1. 把“识别依赖浏览器支持”写清楚
2. 明确区分：
   - 录音成功
   - 转写成功
   - 通话持续识别成功
3. 减少用户把“无转文字”误以为“录音失败”

### P2 如果要做真正稳定版

适合目标：手机网页长期承重

建议：

1. 语音消息转写切服务端
2. 语音通话至少切成“录音分段上传 + 服务端转写”或更稳定的实时方案
3. 浏览器本地识别只保留为轻量增强，不再当主路径

## 最终判断

当前语音能力的主要问题，不是 UI，也不是消息结构，而是底层仍然建立在浏览器本地识别之上。

所以后面如果要继续收稳，优先级应该是：

1. 先承认当前方案的边界
2. 再决定哪些语音能力必须切服务端
3. 不要继续把“浏览器本地识别”当长期稳定底座
