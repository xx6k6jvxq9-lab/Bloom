import React, { Suspense } from 'react';
import type { Dispatch, RefObject, SetStateAction } from 'react';
import { Heart, Image as ImageIcon } from 'lucide-react';
import type { AppData, AppSettings, Character, CoupleSpaceData } from '../../types';
import { HomeScreen } from '../../components/home/HomeScreen/Page';
import { CharacterMomentsProfile, CharacterProfile } from '../../components/main/ContactsShell/Page';
import { MainApp } from '../../components/main/MainAppShell/Page';
import { MomentsApp } from '../../components/moments/Page';
import { ChatSessionMount } from '../chat-session/ChatSessionMount';
import { DreamAppPage } from '../../components/dream/Page';
import { WorldBookManager } from '../../components/main/WorldBookManager';
import { AddCharacterSheet } from '../../components/main/AddCharacterSheet';
import { SettingsApp as SettingsAppScreen } from '../../components/settings/SettingsApp';
import {
  AppPanelFallback as AppPanelFallbackPrimitive,
  ResolvedAssetImage as ResolvedAssetImagePrimitive,
} from './AppShellPrimitives';
import {
  CoupleSpaceApp,
  CustomizationApp,
  ForumApp,
  MonitorApp,
  MusicApp,
  PerceptionView,
  WalletApp,
} from './lazyPanels';
import { DEFAULT_CHARACTERS } from './defaultCharacters';
import { DEFAULT_CONFIG } from './defaultSettings';
import { DEFAULT_ZHOU_JIBAI_AVATAR } from './defaultAppConstants';
import {
  handleCustomizationExportData,
  handleCustomizationImportData,
  handleCustomizationResetData,
  handleCustomizationUpdateAppData,
} from './customizationHandlers';
import { formatMessagePreview } from './formatMessagePreview';
import type { AppScreen, AppTab } from './appShellHandlers';
import type { CoupleSpaceUpdateToast, MomentPublishToast } from './appShellTypes';
import { sanitizeChatGroupsWithCharacters as sanitizeChatGroupsWithCharactersFromStore } from '../persistence/appDataSanitizers';
import { switchCurrentCoupleSpaceState } from '../persistence/coupleSpaceStore';
import { runMomentPublishCommentSequence } from '../../services/moments/commentOrchestrator';
import { resolveSceneTextApiConfig } from '../../services/ai/apiCenter/resolveSceneApiConfig';

type CharacterMomentsBackApp = 'chat' | 'chat-session' | 'character-profile';

type AppScreenContentProps = {
  activeApp: AppScreen;
  activeConfig: AppSettings['configs'][number];
  activeTab: AppTab;
  appData: AppData;
  audioRef: RefObject<HTMLAudioElement | null>;
  characterMomentsBackApp: CharacterMomentsBackApp;
  couplePartnerCharacter: Character;
  coupleSpaceUpdateToast: CoupleSpaceUpdateToast | null;
  currentCoupleSpace: CoupleSpaceData;
  dreamGenerationToast: {
    kind: 'completed';
    taskId: string;
    title: string;
    message: string;
  } | null;
  dreamResumeSignal: number;
  handleAcceptCoupleSpaceInvite: (partnerId: string) => void;
  handleAddCharacter: (character: Character) => void;
  handleMergeCharacter: (character: Character) => void;
  handleOpenApp: (app: AppScreen) => void;
  handleOpenChat: (characterId: string) => void;
  handlePatchCharacterById: (characterId: string, patch: Partial<Character>) => void;
  handleUpdateCurrentCoupleSpace: (updates: any) => void;
  handleUpsertCharacter: (character: Character) => void;
  momentPublishToast: MomentPublishToast | null;
  selectedCharacter: Character | null;
  selectedCharacterId: string | null;
  selectedForumPostId: string | null;
  selectedGroupId: string | null;
  setActiveApp: Dispatch<SetStateAction<AppScreen>>;
  setActiveTab: Dispatch<SetStateAction<AppTab>>;
  setAppData: Dispatch<SetStateAction<AppData>>;
  setCharacterMomentsBackApp: Dispatch<SetStateAction<CharacterMomentsBackApp>>;
  setCoupleSpaceUpdateToast: Dispatch<SetStateAction<CoupleSpaceUpdateToast | null>>;
  setMomentPublishToast: Dispatch<SetStateAction<MomentPublishToast | null>>;
  setSelectedCharacterId: Dispatch<SetStateAction<string | null>>;
  setSelectedForumPostId: Dispatch<SetStateAction<string | null>>;
  setSelectedGroupId: Dispatch<SetStateAction<string | null>>;
  setSettings: Dispatch<SetStateAction<AppSettings>>;
  setStatusBarVisible: Dispatch<SetStateAction<boolean>>;
  settings: AppSettings;
  onOpenReadyDream: () => void;
  onDismissDreamToast: () => void;
};

export function AppScreenContent({
  activeApp,
  activeConfig,
  activeTab,
  appData,
  audioRef,
  characterMomentsBackApp,
  couplePartnerCharacter,
  coupleSpaceUpdateToast,
  currentCoupleSpace,
  dreamGenerationToast,
  dreamResumeSignal,
  handleAcceptCoupleSpaceInvite,
  handleAddCharacter,
  handleMergeCharacter,
  handleOpenApp,
  handleOpenChat,
  handlePatchCharacterById,
  handleUpdateCurrentCoupleSpace,
  handleUpsertCharacter,
  momentPublishToast,
  selectedCharacter,
  selectedCharacterId,
  selectedForumPostId,
  selectedGroupId,
  setActiveApp,
  setActiveTab,
  setAppData,
  setCharacterMomentsBackApp,
  setCoupleSpaceUpdateToast,
  setMomentPublishToast,
  setSelectedCharacterId,
  setSelectedForumPostId,
  setSelectedGroupId,
  setSettings,
  setStatusBarVisible,
  settings,
  onOpenReadyDream,
  onDismissDreamToast,
}: AppScreenContentProps) {
  const screenRootBackgroundClass =
    activeApp === 'home' || activeApp === 'dream'
      ? 'bg-transparent'
      : 'bg-zinc-50';
  const forumConfig = resolveSceneTextApiConfig({
    settings,
    scene: 'forum',
  }).runtimeConfig;
  const appendLikeToMoment = (momentId: string, likerId: string) => {
    setAppData((prev) => ({
      ...prev,
      moments: (prev.moments || []).map((moment) => {
        if (moment.id !== momentId) return moment;
        const likedBy = moment.likedBy || [];
        if (likedBy.includes(likerId)) return moment;
        const nextLikedBy = [...likedBy, likerId];
        return {
          ...moment,
          likedBy: nextLikedBy,
          likes: nextLikedBy.length,
        };
      }),
    }));
  };

  const appendCommentToMoment = (momentId: string, comment: import('../../types').MomentComment) => {
    setAppData((prev) => ({
      ...prev,
      moments: (prev.moments || []).map((moment) => (
        moment.id === momentId
          ? { ...moment, comments: [...moment.comments, comment] }
          : moment
      )),
    }));
  };

  return (
    <div className={`phone-screen-root flex-1 relative overflow-hidden ${screenRootBackgroundClass}`}>
      {coupleSpaceUpdateToast && (
        <button
          type="button"
          onClick={() => {
            setAppData((prev) => {
              const switched = switchCurrentCoupleSpaceState(
                prev.coupleSpaceState,
                prev.coupleSpace,
                coupleSpaceUpdateToast.partnerId,
              );
              return {
                ...prev,
                coupleSpaceState: switched.coupleSpaceState,
                coupleSpace: switched.coupleSpace,
              };
            });
            setActiveApp('couple-space');
            setCoupleSpaceUpdateToast(null);
          }}
          className="absolute left-4 right-4 top-4 z-[70] rounded-3xl border border-white/70 bg-white/92 p-4 text-left shadow-lg backdrop-blur-md"
        >
          <div className="flex items-center gap-3">
            <div className="h-11 w-11 overflow-hidden rounded-2xl bg-[#fff3f7]">
              {coupleSpaceUpdateToast.partnerAvatar ? (
                <ResolvedAssetImagePrimitive
                  value={coupleSpaceUpdateToast.partnerAvatar}
                  alt={coupleSpaceUpdateToast.partnerName}
                  className="h-full w-full object-cover"
                />
              ) : (
                <div className="flex h-full w-full items-center justify-center text-[#d99ab5]">
                  <Heart size={18} />
                </div>
              )}
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-xs font-medium text-zinc-400">情侣空间</div>
              <div className="mt-0.5 text-sm font-bold text-zinc-800">
                {coupleSpaceUpdateToast.partnerName} 更新了{coupleSpaceUpdateToast.moduleLabel}
              </div>
              <div className="mt-1 text-xs text-zinc-500">点开看看这次的新内容</div>
            </div>
          </div>
        </button>
      )}
      {momentPublishToast && (
        <button
          type="button"
          onClick={() => {
            setActiveApp('chat');
            setActiveTab('moments');
            setMomentPublishToast(null);
          }}
          className={`absolute left-4 right-4 ${coupleSpaceUpdateToast ? 'top-[98px]' : 'top-4'} z-[69] rounded-3xl border border-white/70 bg-white/92 p-4 text-left shadow-lg backdrop-blur-md`}
        >
          <div className="flex items-center gap-3">
            <div className="h-11 w-11 overflow-hidden rounded-2xl bg-zinc-100">
              {momentPublishToast.authorAvatar ? (
                <ResolvedAssetImagePrimitive
                  value={momentPublishToast.authorAvatar}
                  alt={momentPublishToast.authorName}
                  className="h-full w-full object-cover"
                />
              ) : (
                <div className="flex h-full w-full items-center justify-center text-zinc-500">
                  <ImageIcon size={18} />
                </div>
              )}
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-xs font-medium text-zinc-400">角色动态</div>
              <div className="mt-0.5 text-sm font-bold text-zinc-800">
                {momentPublishToast.authorName} 发布了一条动态
              </div>
              <div className="mt-1 truncate text-xs text-zinc-500">
                {momentPublishToast.preview || '点开看看这次的新内容'}
              </div>
            </div>
          </div>
        </button>
      )}
      {dreamGenerationToast && (
        <div
          className={`absolute left-4 right-4 ${coupleSpaceUpdateToast ? (momentPublishToast ? 'top-[192px]' : 'top-[98px]') : momentPublishToast ? 'top-[98px]' : 'top-4'} z-[68] rounded-3xl border border-[rgba(196,169,106,.45)] bg-[rgba(8,12,24,.92)] p-4 text-left shadow-lg backdrop-blur-md`}
        >
          <div className="flex items-start gap-3">
            <div className="mt-0.5 flex h-11 w-11 items-center justify-center rounded-2xl bg-[rgba(196,169,106,.12)] text-[#d9c08a]">
              <Heart size={18} />
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-xs font-medium text-[#9ebee2]">梦境提示</div>
              <div className="mt-0.5 text-sm font-bold text-white">
                {dreamGenerationToast.title}
              </div>
              <div className="mt-1 text-xs text-[rgba(237,230,214,.72)]">
                {dreamGenerationToast.message}
              </div>
            </div>
            <button
              type="button"
              onClick={onOpenReadyDream}
              className="rounded-full bg-[rgba(196,169,106,.14)] px-3 py-1 text-xs font-medium text-[#f1dfb2] transition hover:bg-[rgba(196,169,106,.2)]"
            >
              点开进入
            </button>
            <button
              type="button"
              onClick={onDismissDreamToast}
              className="rounded-full px-2 py-1 text-xs text-[rgba(237,230,214,.68)]"
            >
              稍后再看
            </button>
          </div>
        </div>
      )}
      {activeApp === 'home' && (
        <HomeScreen
          key="home"
          onOpenApp={handleOpenApp}
          userProfile={appData.userProfile}
          setUserProfile={(profile) => setAppData((prev) => ({ ...prev, userProfile: profile }))}
          visualSettings={appData.visualSettings}
          setVisualSettings={(s) => setAppData((prev) => ({ ...prev, visualSettings: s }))}
          appData={appData}
          setAppData={setAppData}
        />
      )}
      {activeApp === 'chat' && (
        <MainApp
          key="chat"
          activeTab={activeTab}
          setActiveTab={setActiveTab}
          appData={appData}
          setAppData={setAppData}
          onOpenChat={handleOpenChat}
          onOpenGroupChat={(id) => {
            setSelectedGroupId(id);
            setActiveApp('group-chat-session');
          }}
          onOpenProfile={(id) => {
            setSelectedCharacterId(id);
            setActiveApp('character-profile');
          }}
          onAddCharacter={() => setActiveApp('add-character')}
          onBack={() => setActiveApp('home')}
          settings={settings}
          MomentsAppComponent={MomentsApp}
          formatMessagePreview={formatMessagePreview}
        />
      )}
      {activeApp === 'character-profile' && selectedCharacter && (
        <CharacterProfile
          character={selectedCharacter}
          onBack={() => setActiveApp('chat')}
          onChat={() => {
            setActiveApp('chat-session');
          }}
          onOpenMoments={() => {
            setCharacterMomentsBackApp('character-profile');
            setActiveApp('character-moments');
          }}
          onAddFriend={() => {
            alert('已发送好友请求');
          }}
          isFriend={true}
          groups={appData.groups}
          onUpdateGroup={(groupId) => {
            if (!selectedCharacterId) return;
            handlePatchCharacterById(selectedCharacterId, { groupId });
          }}
          onTogglePin={() => {
            if (!selectedCharacterId || !selectedCharacter) return;
            handlePatchCharacterById(selectedCharacterId, { isPinned: !selectedCharacter.isPinned });
          }}
        />
      )}
      {activeApp === 'character-moments' && selectedCharacter && (
        <CharacterMomentsProfile
          character={selectedCharacter}
          appData={appData}
          setAppData={setAppData}
          settings={settings}
          moments={appData.moments || []}
          onBack={() => setActiveApp(characterMomentsBackApp)}
        />
      )}
      <ChatSessionMount
        activeApp={activeApp}
        selectedCharacterId={selectedCharacterId}
        selectedGroupId={selectedGroupId}
        characters={appData.characters}
        chatGroups={appData.chatGroups || []}
        setChatGroups={(chatGroupsOrUpdater) =>
          setAppData((prev) => {
            const resolvedChatGroups =
              typeof chatGroupsOrUpdater === 'function'
                ? chatGroupsOrUpdater(prev.chatGroups || [])
                : chatGroupsOrUpdater;

            return {
              ...prev,
              chatGroups: sanitizeChatGroupsWithCharactersFromStore(resolvedChatGroups, prev.characters),
            };
          })
        }
        chatHistory={appData.chatHistory}
        setChatHistory={(chatHistory) => setAppData((prev) => ({ ...prev, chatHistory }))}
        settings={settings}
        setSettings={setSettings}
        userAvatar={appData.userProfile.avatar}
        userName={appData.userProfile.name}
        masks={appData.masks}
        favorites={appData.favorites}
        setFavorites={(f) => setAppData((prev) => ({ ...prev, favorites: f }))}
        visualSettings={appData.visualSettings}
        setVisualSettings={(visualSettings) => setAppData((prev) => ({ ...prev, visualSettings }))}
        groups={appData.groups}
        worldBook={appData.worldBooks || []}
        perception={currentCoupleSpace.perception}
        coupleSpace={currentCoupleSpace}
        callHistory={appData.callHistory || []}
        setCallHistory={(callHistory) => setAppData((prev) => ({ ...prev, callHistory }))}
        savedDates={appData.savedDates || []}
        collectedDates={appData.collectedDates || []}
        setDatingRecords={({ savedDates, collectedDates }) =>
          setAppData((prev) => ({
            ...prev,
            savedDates,
            collectedDates,
          }))
        }
        walletData={appData.walletData}
        setWalletData={(data) => setAppData((prev) => ({ ...prev, walletData: data }))}
        updateCharacter={handleMergeCharacter}
        patchCharacter={handlePatchCharacterById}
        onBackToChat={() => setActiveApp('chat')}
        onViewForumPost={(postId) => {
          setSelectedForumPostId(postId);
          setActiveApp('forum');
        }}
        onPublishMoment={({ authorId, content, images, imageCard, isCollected, sourceChatMessage }) => {
          const author = appData.characters.find((character) => character.id === authorId) || null;
          const newMomentId = Date.now().toString();
          const newMoment = {
            id: newMomentId,
            authorId,
            content,
            images,
            imageCard,
            sourceChatMessage,
            timestamp: Date.now(),
            likes: 0,
            comments: [],
            ...(isCollected ? { isCollected: true } : {}),
          };
          console.info('[moment-special] onPublishMoment called', {
            authorId,
            content,
            imagesCount: images?.length || 0,
            hasImageCard: !!imageCard,
          });
          setAppData((prev) => ({
            ...(console.info('[moment-special] moments latest', {
              length: (prev.moments?.length || 0) + 1,
              latestContent: content,
            }), prev),
            moments: [newMoment, ...(prev.moments || [])],
          }));

          const shuffledCharacters = [...appData.characters].sort(() => Math.random() - 0.5);
          const replyCount = Math.min(
            shuffledCharacters.length,
            shuffledCharacters.length <= 2 ? shuffledCharacters.length : (Math.random() < 0.5 ? 2 : 3),
          );
          const autoLikerIds = shuffledCharacters
            .filter((character) => {
              const likeChance = Math.random() < 0.5 ? 0.75 : 0.4;
              return Math.random() < likeChance;
            })
            .map((character) => character.id)
            .slice(0, Math.min(shuffledCharacters.length, 3));

          if (autoLikerIds.length > 0) {
            void (async () => {
              for (const likerId of autoLikerIds) {
                await new Promise((resolve) => setTimeout(resolve, 150 + Math.floor(Math.random() * 500)));
                appendLikeToMoment(newMomentId, likerId);
              }
            })();
          }

          if (forumConfig && replyCount > 0) {
            void runMomentPublishCommentSequence({
              activeConfig: forumConfig,
              moment: newMoment,
              characters: appData.characters,
              userName: appData.userProfile.name,
              appendComment: (comment) => appendCommentToMoment(newMomentId, comment),
            });
          }

          if (author) {
            setMomentPublishToast({
              id: `${authorId}-${Date.now()}`,
              authorId,
              authorName: author.name,
              authorAvatar: author.avatar,
              preview: content.slice(0, 26),
            });
          }
        }}
        onOpenCharacterMoments={() => {
          setCharacterMomentsBackApp('chat-session');
          setActiveApp('character-moments');
        }}
        onStatusBarVisibilityChange={setStatusBarVisible}
        onAcceptCoupleSpaceInvite={handleAcceptCoupleSpaceInvite}
      />
      {activeApp === 'add-character' && (
        <AddCharacterSheet
          key="add-character"
          onSave={handleAddCharacter}
          onBack={() => setActiveApp('chat')}
          groups={appData.groups}
        />
      )}
      {activeApp === 'settings' && (
        <SettingsAppScreen
          key="settings"
          onBack={() => setActiveApp('home')}
          settings={settings}
          defaultConfig={DEFAULT_CONFIG}
          setSettings={setSettings}
          characters={appData.characters}
        />
      )}
      {activeApp === 'dream' && (
        <DreamAppPage
          key="dream"
          onBack={() => setActiveApp('home')}
          characters={appData.characters}
          userName={appData.userProfile.name}
          activeConfig={activeConfig}
          masks={appData.masks || []}
          worldBooks={appData.worldBooks || []}
          resumeBackgroundSignal={dreamResumeSignal}
        />
      )}
      {activeApp === 'worldbook' && (
        <WorldBookManager
          worldBooks={appData.worldBooks || []}
          characters={appData.characters}
          setWorldBooks={(wb) => setAppData((prev) => ({ ...prev, worldBooks: wb }))}
          onBack={() => setActiveApp('home')}
          globalBackground={appData.visualSettings?.globalBackground || ''}
          onAddCharacter={(char) => {
            const newChar: Character = {
              id: Date.now().toString(),
              ...char,
              lastTime: Date.now(),
            };
            handleUpsertCharacter(newChar);
          }}
        />
      )}
      {activeApp === 'monitor' && (
        <Suspense fallback={<AppPanelFallbackPrimitive label="监控中心" />}>
          <MonitorApp
            characters={appData.characters}
            onBack={() => setActiveApp('home')}
            visualSettings={appData.visualSettings}
          />
        </Suspense>
      )}
      {activeApp === 'customization' && (
        <Suspense fallback={<AppPanelFallbackPrimitive label="自定义中心" />}>
          <CustomizationApp
            visualSettings={appData.visualSettings}
            setVisualSettings={(s) => setAppData((prev) => ({ ...prev, visualSettings: s }))}
            onBack={() => setActiveApp('home')}
            onResetData={handleCustomizationResetData}
            onExportData={() => handleCustomizationExportData(appData)}
            onImportData={(data) =>
              handleCustomizationImportData({
                data,
                defaultCharacters: DEFAULT_CHARACTERS,
                defaultZhouJibaiAvatar: DEFAULT_ZHOU_JIBAI_AVATAR,
                setAppData,
              })
            }
            appData={appData}
            setAppData={setAppData}
            settings={settings}
            setSettings={setSettings}
          />
        </Suspense>
      )}
      {activeApp === 'couple-space' && (
        <Suspense fallback={<AppPanelFallbackPrimitive label="情侣空间" />}>
          <CoupleSpaceApp
            appData={appData}
            setAppData={setAppData}
            onBack={() => setActiveApp('home')}
            settings={settings}
          />
        </Suspense>
      )}
      {activeApp === 'perception' && (
        <Suspense fallback={<AppPanelFallbackPrimitive label="感知视图" />}>
          <PerceptionView
            coupleSpace={currentCoupleSpace}
            updateSpace={handleUpdateCurrentCoupleSpace}
            onBack={() => setActiveApp('home')}
          />
        </Suspense>
      )}
      <audio
        ref={audioRef}
        preload="auto"
        playsInline
        className="pointer-events-none absolute h-0 w-0 opacity-0"
        aria-hidden="true"
      />
      {activeApp === 'music' && (
        <Suspense fallback={<AppPanelFallbackPrimitive label="音乐" />}>
          <MusicApp
            musicData={appData.musicData!}
            onUpdateMusicData={(data) => setAppData((prev) => ({ ...prev, musicData: data }))}
            userAvatar={appData.userProfile.avatar}
            userName={appData.userProfile.name}
            character={couplePartnerCharacter}
            directChatHistory={appData.chatHistory}
            visualSettings={appData.visualSettings}
            settings={settings}
            onPatchCharacter={handlePatchCharacterById}
            allCharacters={appData.characters}
            onBack={() => setActiveApp('home')}
            audioRef={audioRef}
          />
        </Suspense>
      )}
      {activeApp === 'forum' && (
        <Suspense fallback={<AppPanelFallbackPrimitive label="论坛" />}>
          <ForumApp
            appData={appData}
            onUpdateAppData={(newData) => handleCustomizationUpdateAppData(newData, setAppData)}
            onClose={() => setActiveApp('home')}
            settings={settings}
            onOpenChat={(characterId) => {
              setSelectedCharacterId(characterId);
              setActiveApp('chat-session');
            }}
            initialPostId={selectedForumPostId}
          />
        </Suspense>
      )}
      {activeApp === 'wallet' && (
        <Suspense fallback={<AppPanelFallbackPrimitive label="钱包" />}>
          <WalletApp
            appData={appData}
            onUpdateAppData={(newData) => handleCustomizationUpdateAppData(newData, setAppData)}
            onClose={() => setActiveApp('home')}
          />
        </Suspense>
      )}
    </div>
  );
}
