import React from "react";
import { motion } from "motion/react";
import { ChevronLeft, Keyboard, Mic, Send, Smile } from "lucide-react";
import type { AppSettings, Character, ChatMessage, VisualSettings } from "../../types";
import { useResolvedPersistentValue } from "../persistence/useResolvedPersistentValue";
import { saveUploadedBlob } from "../persistence/persistentAssetService";
import {
  buildScopedBubbleThemeCss,
  buildScopedBubbleVariantCss,
  extractBubbleTextStyle,
  hasBubbleThemeCss,
  parseBubbleStyleCss,
  sanitizeBubbleSurfaceStyle,
} from "../chat-session/bubbleStyleCss";
import { getThemeSelectedFontStack } from "../theme/themeTypography";
import { AudioMessageCard } from "../chat-session/AudioMessageCard";
import { useAudioMessageRecorder } from "../chat-session/useAudioMessageRecorder";

function BubbleThemeAnchors() {
  return (
    <>
      <span aria-hidden="true" className="corner bubble-corner tl pointer-events-none absolute" />
      <span aria-hidden="true" className="corner bubble-corner tr pointer-events-none absolute" />
      <span aria-hidden="true" className="corner bubble-corner bl pointer-events-none absolute" />
      <span aria-hidden="true" className="corner bubble-corner br pointer-events-none absolute" />
      <span aria-hidden="true" className="sticker-skull bubble-sticker-skull pointer-events-none absolute" />
    </>
  );
}

function ResolvedMusicAvatar({
  value,
  alt,
  className,
}: {
  value?: string | null;
  alt?: string;
  className: string;
}) {
  const { resolvedUrl } = useResolvedPersistentValue(value);

  if (!resolvedUrl) {
    return <div className={`${className} bg-zinc-100`} aria-label={alt || "avatar"} />;
  }

  return <img src={resolvedUrl} alt={alt || "avatar"} className={className} />;
}

type TogetherChatPanelProps = {
  activeTogetherCharacter: Character;
  settings: AppSettings;
  userAvatar: string;
  userName: string;
  history: ChatMessage[];
  chatInput: string;
  isSendingTogetherChat: boolean;
  visualSettings: VisualSettings;
  chatEndRef: React.RefObject<HTMLDivElement | null>;
  onBack: () => void;
  onInputChange: (value: string) => void;
  onSend: () => void;
  onSendSticker: (sticker: string) => void | Promise<void>;
  onSendAudio: (payload: {
    audioUrl: string;
    audioMimeType: string;
    durationSeconds?: number;
  }) => void | Promise<void>;
};

function stripVisualMessageMarker(text?: string) {
  return (text || "").replace(/^\[(?:sticker|image|audio|表情包|图片|语音)\]\s*/i, "").trim();
}

function isStickerMessage(message: Pick<ChatMessage, "imageUrl" | "text">) {
  return !!message.imageUrl && /^\[(?:sticker|表情包)\]/i.test((message.text || "").trim());
}

function ResolvedChatImage({
  value,
  alt,
  className,
}: {
  value?: string | null;
  alt: string;
  className: string;
}) {
  const { resolvedUrl } = useResolvedPersistentValue(value);

  if (!resolvedUrl) {
    return <div className={`${className} bg-zinc-100`} aria-label={alt} />;
  }

  return <img src={resolvedUrl} alt={alt} className={className} />;
}

export function TogetherChatPanel({
  activeTogetherCharacter,
  settings,
  userAvatar,
  userName,
  history,
  chatInput,
  isSendingTogetherChat,
  visualSettings,
  chatEndRef,
  onBack,
  onInputChange,
  onSend,
  onSendSticker,
  onSendAudio,
}: TogetherChatPanelProps) {
  const [showStickerPanel, setShowStickerPanel] = React.useState(false);
  const [stickerTab, setStickerTab] = React.useState<"basic" | "custom">("basic");
  const [isVoiceMode, setIsVoiceMode] = React.useState(false);
  const { resolvedUrl: resolvedCharacterBubbleImageUrl } = useResolvedPersistentValue(
    activeTogetherCharacter.bubbleImage,
  );
  const { resolvedUrl: resolvedUserBubbleImageUrl } = useResolvedPersistentValue(
    activeTogetherCharacter.userBubbleImage,
  );
  const directBubbleThemeCss = buildScopedBubbleThemeCss(
    visualSettings?.chat?.bubbleStyleCss,
    ".chat-bubble-theme-scope",
  );
  const directModelBubbleThemeCss = buildScopedBubbleVariantCss(
    visualSettings?.chat?.modelBubbleStyleCss,
    ".chat-bubble-theme-scope",
    ".bot-bubble",
  );
  const directUserBubbleThemeCss = buildScopedBubbleVariantCss(
    visualSettings?.chat?.userBubbleStyleCss,
    ".chat-bubble-theme-scope",
    ".user-bubble",
  );
  const directCharacterBubbleThemeCss = hasBubbleThemeCss(activeTogetherCharacter.bubbleStyleCss)
    ? buildScopedBubbleThemeCss(activeTogetherCharacter.bubbleStyleCss, ".chat-bubble-theme-scope")
    : buildScopedBubbleVariantCss(
        activeTogetherCharacter.bubbleStyleCss,
        ".chat-bubble-theme-scope",
        ".chat-bubble-left",
      );
  const directCharacterUserBubbleThemeCss = hasBubbleThemeCss(activeTogetherCharacter.userBubbleStyleCss)
    ? buildScopedBubbleThemeCss(activeTogetherCharacter.userBubbleStyleCss, ".chat-bubble-theme-scope")
    : buildScopedBubbleVariantCss(
        activeTogetherCharacter.userBubbleStyleCss,
        ".chat-bubble-theme-scope",
        ".chat-bubble-right",
      );
  const chatFontFamily = getThemeSelectedFontStack(visualSettings?.themeTypography);
  const chatTextStyle = chatFontFamily ? { fontFamily: chatFontFamily } : undefined;
  const basicEmojis = ["🙂", "😆", "🥺", "😼", "😊", "🤍", "😉", "😳", "🫶", "🌙", "😇", "🥹", "🎵", "🎧"];
  const availableCustomStickers = Array.from(
    new Set(
      [
        ...(settings.sharedStickers || []),
        ...(activeTogetherCharacter.stickers || []),
      ]
        .filter(
          (sticker): sticker is string =>
            typeof sticker === "string" && sticker.trim().length > 0,
        )
        .map((sticker) => sticker.trim()),
    ),
  );
  const directChatFontCss = chatFontFamily
    ? `.chat-bubble-theme-scope .chat-bubble,
.chat-bubble-theme-scope .chat-bubble *,
.chat-bubble-theme-scope .chat-loading-bubble,
.chat-bubble-theme-scope .chat-loading-bubble *,
.chat-bubble-theme-scope .chat-session-header,
.chat-bubble-theme-scope .chat-session-header *,
.chat-bubble-theme-scope .chat-session-footer,
.chat-bubble-theme-scope .chat-session-footer * {
  font-family: ${chatFontFamily} !important;
}`
    : "";
  const {
    isRecording,
    startRecording,
    stopRecording,
    cancelRecording,
  } = useAudioMessageRecorder({
    onRecorded: async ({ blob, durationMs, transcript }) => {
      const audioUrl = await saveUploadedBlob(blob, {
        fileName: `music-together-voice-${Date.now()}.wav`,
        mimeType: "audio/wav",
      });
      await onSendAudio({
        audioUrl,
        audioMimeType: "audio/wav",
        durationSeconds: Math.max(1, Math.round(durationMs / 1000)),
        ...(transcript?.trim() ? { transcript: transcript.trim() } : {}),
      });
    },
  });
  const handleVoicePointerDown = (event: React.PointerEvent<HTMLButtonElement>) => {
    if (typeof event.currentTarget.setPointerCapture === "function") {
      try {
        event.currentTarget.setPointerCapture(event.pointerId);
      } catch {
        // Ignore capture failures and still try to record.
      }
    }
    void startRecording();
  };

  const handleVoicePointerUp = (event: React.PointerEvent<HTMLButtonElement>) => {
    if (typeof event.currentTarget.releasePointerCapture === "function") {
      try {
        event.currentTarget.releasePointerCapture(event.pointerId);
      } catch {
        // Ignore release failures.
      }
    }
    stopRecording();
  };

  const handleVoicePointerCancel = (event: React.PointerEvent<HTMLButtonElement>) => {
    if (typeof event.currentTarget.releasePointerCapture === "function") {
      try {
        event.currentTarget.releasePointerCapture(event.pointerId);
      } catch {
        // Ignore release failures.
      }
    }
    cancelRecording();
  };

  const getDirectTextBubbleClass = (role: ChatMessage["role"]) => {
    if (role === "model") {
      return "inline-block max-w-[min(82%,34rem)] px-4 py-3 rounded-2xl";
    }

    return "w-fit max-w-[min(82%,34rem)] px-4 py-3 rounded-2xl";
  };

  const getDirectTextBubbleStyle = (role: ChatMessage["role"]): React.CSSProperties => {
    const hasGlobalTheme = hasBubbleThemeCss(visualSettings?.chat?.bubbleStyleCss);
    const hasRoleTheme = hasBubbleThemeCss(
      role === "model"
        ? visualSettings?.chat?.modelBubbleStyleCss
        : visualSettings?.chat?.userBubbleStyleCss,
    );
    const characterRoleBubbleStyleCss =
      role === "model"
        ? activeTogetherCharacter.bubbleStyleCss
        : activeTogetherCharacter.userBubbleStyleCss;
    const hasCharacterRoleTheme = hasBubbleThemeCss(characterRoleBubbleStyleCss);
    const shouldUseDefaultBubbleSurface = !hasGlobalTheme && !hasRoleTheme && !hasCharacterRoleTheme;
    const globalBubbleStyle = sanitizeBubbleSurfaceStyle(
      parseBubbleStyleCss(visualSettings?.chat?.bubbleStyleCss),
    );
    const globalRoleBubbleStyle = sanitizeBubbleSurfaceStyle(
      parseBubbleStyleCss(
        role === "model"
          ? visualSettings?.chat?.modelBubbleStyleCss
          : visualSettings?.chat?.userBubbleStyleCss,
      ),
    );
    const characterBubbleStyle = sanitizeBubbleSurfaceStyle(parseBubbleStyleCss(characterRoleBubbleStyleCss));
    const resolvedRoleBubbleImageUrl =
      role === "model" ? resolvedCharacterBubbleImageUrl : resolvedUserBubbleImageUrl;
    const roleBubbleColor =
      role === "model" ? activeTogetherCharacter.bubbleColor : activeTogetherCharacter.userBubbleColor;

    return {
      ...(shouldUseDefaultBubbleSurface
        ? {
            borderRadius: visualSettings?.chat?.messageBorderRadius ?? 16,
            borderTopRightRadius:
              role === "user" ? 6 : visualSettings?.chat?.messageBorderRadius ?? 16,
            borderTopLeftRadius:
              role === "model" ? 6 : visualSettings?.chat?.messageBorderRadius ?? 16,
            boxShadow:
              role === "user"
                ? "0 10px 24px rgba(59, 130, 246, 0.18)"
                : "0 10px 24px rgba(15, 23, 42, 0.08)",
            backgroundColor:
              role === "user"
                ? visualSettings?.chat?.messageBackgroundColorUser || "rgba(59,130,246,1)"
                : visualSettings?.chat?.messageBackgroundColorModel || "rgba(255,255,255,0.95)",
            borderColor:
              role === "user"
                ? visualSettings?.chat?.messageBackgroundColorUser || "rgba(59,130,246,1)"
                : "rgba(228, 228, 231, 1)",
          }
        : {}),
      ...(hasCharacterRoleTheme ? {} : globalBubbleStyle),
      ...(hasCharacterRoleTheme ? {} : globalRoleBubbleStyle),
      ...(resolvedRoleBubbleImageUrl
        ? {
            backgroundImage: `url(${resolvedRoleBubbleImageUrl})`,
            backgroundSize: "cover",
            backgroundPosition: "center",
            border: "none",
          }
        : roleBubbleColor
          ? {
              backgroundColor: roleBubbleColor,
              borderColor: roleBubbleColor,
            }
          : {}),
      ...characterBubbleStyle,
    };
  };

  const getDirectTextContentStyle = (role: ChatMessage["role"]): React.CSSProperties => {
    const characterRoleBubbleStyleCss =
      role === "model"
        ? activeTogetherCharacter.bubbleStyleCss
        : activeTogetherCharacter.userBubbleStyleCss;

    return {
      ...extractBubbleTextStyle(parseBubbleStyleCss(visualSettings?.chat?.bubbleStyleCss)),
      ...extractBubbleTextStyle(
        parseBubbleStyleCss(
          role === "model"
            ? visualSettings?.chat?.modelBubbleStyleCss
            : visualSettings?.chat?.userBubbleStyleCss,
        ),
      ),
      ...extractBubbleTextStyle(parseBubbleStyleCss(characterRoleBubbleStyleCss)),
    };
  };

  return (
    <motion.div
      initial={{ x: "100%" }}
      animate={{ x: 0 }}
      exit={{ x: "100%" }}
      className="chat-bubble-theme-scope absolute inset-0 z-[200] flex flex-col overflow-hidden bg-zinc-50"
      style={{ minHeight: "100dvh", height: "100dvh" }}
    >
      <style>{directBubbleThemeCss}</style>
      <style>{directModelBubbleThemeCss}</style>
      <style>{directUserBubbleThemeCss}</style>
      <style>{directCharacterBubbleThemeCss}</style>
      <style>{directCharacterUserBubbleThemeCss}</style>
      <style>{directChatFontCss}</style>

      <div
        className="chat-session-header flex items-center justify-between border-b border-zinc-100 bg-white/95 px-6 pb-4 backdrop-blur-md"
        style={{ paddingTop: "calc(env(safe-area-inset-top, 0px) + 12px)" }}
      >
        <button onClick={onBack} className="p-2 -ml-2 text-zinc-500">
          <ChevronLeft size={28} strokeWidth={2.5} />
        </button>
        <div className="flex flex-col items-center">
          <h2 className="text-sm font-bold text-zinc-800">一起听聊天</h2>
          <div className="flex items-center gap-1.5 mt-0.5">
            <div className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
            <span className="text-[10px] text-zinc-400 font-medium">
              正在和 {activeTogetherCharacter.name} 共听
            </span>
          </div>
        </div>
        <div className="w-10" />
      </div>

      <div
        className="flex-1 overflow-y-auto bg-zinc-50/50 p-4 space-y-4"
        style={{ paddingBottom: "calc(env(safe-area-inset-bottom, 0px) + 16px)" }}
      >
        {history.map((msg, index) => (
          <div
            key={`${msg.timestamp}-${index}`}
            className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"} items-end gap-2`}
          >
            {msg.role === "model" && (
              <ResolvedMusicAvatar
                value={activeTogetherCharacter.avatar}
                className="w-8 h-8 rounded-full object-cover shadow-sm mb-1"
                alt={activeTogetherCharacter.name}
              />
            )}
            {msg.audioUrl ? (
                <AudioMessageCard
                  value={msg.audioUrl}
                  durationSeconds={msg.duration}
                  transcript={msg.audioTranscript || null}
                  showTranscript={!!msg.audioTranscript}
                  isUser={msg.role === "user"}
                  className="shadow-none"
                />
            ) : (
              <div
                className={`chat-bubble message-bubble ${msg.role === "user" ? "user-bubble right chat-bubble-right" : "bot-bubble left chat-bubble-left"} ${getDirectTextBubbleClass(msg.role)} relative border ${
                  msg.role === "user" ? "text-white" : "text-zinc-800"
                }`}
                style={{
                  ...getDirectTextBubbleStyle(msg.role),
                  ...(chatTextStyle || {}),
                }}
              >
                <BubbleThemeAnchors />
                {msg.imageUrl ? (
                  <div className="flex flex-col gap-2">
                    <ResolvedChatImage
                      value={msg.imageUrl}
                      alt={isStickerMessage(msg) ? "表情包" : "图片"}
                      className={`rounded-2xl object-contain ${
                        isStickerMessage(msg) ? "max-h-40 max-w-[11rem]" : "max-h-60 max-w-[18rem]"
                      }`}
                    />
                    {stripVisualMessageMarker(msg.text) ? (
                      <span
                        className={`block whitespace-pre-wrap break-words text-left ${
                          isStickerMessage(msg) ? "text-[16px] leading-7" : "text-[14px] leading-6"
                        }`}
                        style={{
                          ...chatTextStyle,
                          ...getDirectTextContentStyle(msg.role),
                        }}
                      >
                        {stripVisualMessageMarker(msg.text)}
                      </span>
                    ) : null}
                  </div>
                ) : (
                  <span
                    className="block text-[14px] leading-6 whitespace-pre-wrap break-words text-left"
                    style={{
                      ...chatTextStyle,
                      ...getDirectTextContentStyle(msg.role),
                      overflowWrap: "anywhere",
                      wordBreak: "break-word",
                    }}
                  >
                    {msg.text}
                  </span>
                )}
              </div>
            )}
            {msg.role === "user" && (
              <ResolvedMusicAvatar
                value={userAvatar}
                className="w-8 h-8 rounded-full object-cover shadow-sm mb-1"
                alt={userName}
              />
            )}
          </div>
        ))}
        {isSendingTogetherChat && (
          <div className="flex justify-start">
            <div className="flex gap-2.5">
              <ResolvedMusicAvatar
                value={activeTogetherCharacter.avatar}
                className="w-8 h-8 rounded-full object-cover mt-0.5 shrink-0"
                alt={activeTogetherCharacter.name}
              />
              <div
                className="chat-bubble message-bubble bot-bubble left chat-bubble-left chat-loading-bubble border rounded-2xl px-4 py-3 shadow-[0_10px_24px_rgba(15,23,42,0.08)]"
                style={{
                  ...getDirectTextBubbleStyle("model"),
                  ...(chatTextStyle || {}),
                  borderTopLeftRadius: 6,
                }}
              >
                <BubbleThemeAnchors />
                <div className="flex gap-1">
                  <span className="w-1.5 h-1.5 bg-zinc-300 rounded-full animate-bounce" />
                  <span className="w-1.5 h-1.5 bg-zinc-300 rounded-full animate-bounce [animation-delay:120ms]" />
                  <span className="w-1.5 h-1.5 bg-zinc-300 rounded-full animate-bounce [animation-delay:240ms]" />
                </div>
              </div>
            </div>
          </div>
        )}
        <div ref={chatEndRef} />
      </div>

      <div
        className="chat-session-footer border-t border-zinc-100 bg-white/95 backdrop-blur-md"
        style={{ paddingBottom: "env(safe-area-inset-bottom, 0px)" }}
      >
        <div className="flex gap-3 items-end p-4">
          <button
            onClick={() => {
              setIsVoiceMode((prev) => !prev);
              if (showStickerPanel) setShowStickerPanel(false);
            }}
            disabled={isSendingTogetherChat}
            className="w-11 h-11 rounded-full bg-zinc-100 text-zinc-700 flex items-center justify-center shrink-0 disabled:opacity-50"
          >
            {isVoiceMode ? <Keyboard size={20} /> : <Mic size={20} />}
          </button>

          {isVoiceMode ? (
            <button
              onPointerDown={handleVoicePointerDown}
              onPointerUp={handleVoicePointerUp}
              onPointerCancel={handleVoicePointerCancel}
              onPointerLeave={() => undefined}
              disabled={isSendingTogetherChat}
              className={`flex-1 h-11 rounded-[28px] font-medium text-[15px] transition-all active:scale-[0.98] select-none ${
                isRecording ? "bg-zinc-200 text-zinc-800" : "bg-zinc-50 border border-zinc-100 text-zinc-700"
              } disabled:opacity-60`}
              style={chatTextStyle}
            >
              {isRecording ? "松开发送" : "按住说话"}
            </button>
          ) : (
            <div className="flex-1 bg-zinc-50 border border-zinc-100 rounded-[28px] px-4 py-2.5 flex items-center gap-2">
              <input
                type="text"
                value={chatInput}
                onChange={(e) => onInputChange(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && onSend()}
                disabled={isSendingTogetherChat}
                placeholder="说点什么..."
                className="flex-1 bg-transparent outline-none text-[14px]"
                style={chatTextStyle}
              />
              <button
                onClick={() => setShowStickerPanel((prev) => !prev)}
                disabled={isSendingTogetherChat}
                className="text-zinc-400 disabled:opacity-50"
              >
                <Smile size={20} />
              </button>
            </div>
          )}

          <button
            onClick={onSend}
            disabled={isSendingTogetherChat || isVoiceMode || !chatInput.trim()}
            className="w-11 h-11 rounded-full bg-pink-500 flex items-center justify-center text-white shadow-lg shadow-pink-200 active:scale-90 transition-transform disabled:opacity-40"
          >
            <Send size={20} />
          </button>
        </div>

        {showStickerPanel && !isVoiceMode && (
          <div
            className="px-4"
            style={{ paddingBottom: "calc(env(safe-area-inset-bottom, 0px) + 16px)" }}
          >
            <div className="rounded-[24px] border border-zinc-100 bg-white p-4 shadow-sm">
              <div className="mb-3 flex border-b border-zinc-100">
                <button
                  onClick={() => setStickerTab("basic")}
                  className={`flex-1 py-2 text-[13px] font-medium transition-colors ${
                    stickerTab === "basic"
                      ? "border-b-2 border-zinc-900 text-zinc-900"
                      : "text-zinc-500 hover:bg-zinc-50"
                  }`}
                >
                  基础表情
                </button>
                <button
                  onClick={() => setStickerTab("custom")}
                  className={`flex-1 py-2 text-[13px] font-medium transition-colors ${
                    stickerTab === "custom"
                      ? "border-b-2 border-zinc-900 text-zinc-900"
                      : "text-zinc-500 hover:bg-zinc-50"
                  }`}
                >
                  自定义表情
                </button>
              </div>

              <div className="h-48 overflow-y-auto">
                {stickerTab === "basic" ? (
                  <div className="grid grid-cols-7 gap-2">
                    {basicEmojis.map((emoji) => (
                      <button
                        key={emoji}
                        onClick={() => onInputChange(`${chatInput}${emoji}`)}
                        className="aspect-square rounded-lg text-2xl hover:bg-zinc-50"
                      >
                        {emoji}
                      </button>
                    ))}
                  </div>
                ) : availableCustomStickers.length > 0 ? (
                  <div className="grid grid-cols-5 gap-2">
                    {availableCustomStickers.map((sticker, index) => (
                      <button
                        key={`${sticker}-${index}`}
                        onClick={() => {
                          void onSendSticker(sticker);
                          setShowStickerPanel(false);
                        }}
                        className="aspect-square overflow-hidden rounded-xl border border-zinc-100 hover:border-pink-200"
                      >
                        <ResolvedChatImage
                          value={sticker}
                          alt={`自定义表情 ${index + 1}`}
                          className="h-full w-full object-cover"
                        />
                      </button>
                    ))}
                  </div>
                ) : (
                  <div className="flex h-full flex-col items-center justify-center text-zinc-400">
                    <Smile size={30} className="mb-2 opacity-50" />
                    <p className="text-[12px]">暂无自定义表情</p>
                    <p className="mt-1 text-[10px]">请先在聊天设置里导入</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </motion.div>
  );
}

