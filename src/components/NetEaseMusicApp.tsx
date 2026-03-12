import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { QRCodeSVG } from 'qrcode.react';
import { 
  ChevronLeft, 
  Search, 
  Play, 
  Pause, 
  SkipBack, 
  SkipForward, 
  Heart, 
  MessageCircle, 
  Share2, 
  ListMusic, 
  User, 
  Users,
  Disc, 
  Menu,
  MoreVertical,
  Download,
  Plus,
  Radio,
  Mic2,
  Library,
  Settings,
  LogOut,
  QrCode,
  Smartphone,
  RefreshCw,
  Loader2
} from 'lucide-react';

// Community API Base URL - Users are encouraged to host their own instance of NeteaseCloudMusicApi
const API_BASE = 'https://netease-cloud-music-api-teal-psi.vercel.app';

type Song = {
  id: string;
  title: string;
  artist: string;
  album: string;
  cover: string;
  url?: string;
};

type UserProfile = {
  nickname: string;
  avatarUrl: string;
  userId: number;
  level?: number;
  signature?: string;
};

export function NetEaseMusicApp({ onBack }: { onBack: () => void; key?: string }) {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [showLoginModal, setShowLoginModal] = useState(false);
  const [loginStep, setLoginStep] = useState<'choice' | 'qr'>('choice');
  const [qrCodeData, setQrCodeData] = useState<{ key: string; url: string } | null>(null);
  const [qrStatus, setQrStatus] = useState<{ code: number; message: string }>({ code: 801, message: '等待扫码' });
  
  const [activeTab, setActiveTab] = useState<'discover' | 'podcast' | 'mine' | 'follow' | 'community'>('discover');
  const [currentSong, setCurrentSong] = useState<Song | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [showPlayer, setShowPlayer] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<Song[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  
  const [userPlaylists, setUserPlaylists] = useState<any[]>([]);
  const [banners, setBanners] = useState<any[]>([]);
  const [recommendedPlaylists, setRecommendedPlaylists] = useState<any[]>([]);
  const [newSongs, setNewSongs] = useState<Song[]>([]);

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const pollTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Initialize audio
  useEffect(() => {
    audioRef.current = new Audio();
    audioRef.current.onended = () => setIsPlaying(false);
    audioRef.current.ontimeupdate = () => {
      if (audioRef.current) setCurrentTime(audioRef.current.currentTime);
    };
    audioRef.current.onloadedmetadata = () => {
      if (audioRef.current) setDuration(audioRef.current.duration);
    };
    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }
      if (pollTimerRef.current) clearInterval(pollTimerRef.current);
    };
  }, []);

  // Fetch Discover Data
  useEffect(() => {
    const fetchDiscoverData = async () => {
      try {
        const [bannerRes, playlistRes, newSongRes] = await Promise.all([
          fetch(`${API_BASE}/banner?type=2`).then(r => r.json()),
          fetch(`${API_BASE}/personalized?limit=6`).then(r => r.json()),
          fetch(`${API_BASE}/personalized/newsong?limit=10`).then(r => r.json())
        ]);
        
        if (bannerRes.banners) setBanners(bannerRes.banners);
        if (playlistRes.result) setRecommendedPlaylists(playlistRes.result);
        if (newSongRes.result) {
          setNewSongs(newSongRes.result.map((s: any) => ({
            id: s.id.toString(),
            title: s.name,
            artist: s.song.artists.map((a: any) => a.name).join('/'),
            album: s.song.album.name,
            cover: s.picUrl,
          })));
        }
      } catch (err) {
        console.error('Fetch discover data error:', err);
      }
    };
    fetchDiscoverData();
  }, []);

  // Fetch User Playlists
  useEffect(() => {
    if (isLoggedIn && userProfile?.userId) {
      const fetchUserPlaylists = async () => {
        try {
          const cookie = localStorage.getItem('netease_cookie') || '';
          const res = await fetch(`${API_BASE}/user/playlist?uid=${userProfile.userId}&timestamp=${Date.now()}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ cookie })
          });
          const data = await res.json();
          if (data.playlist) {
            setUserPlaylists(data.playlist);
          }
        } catch (err) {
          console.error('Fetch user playlists error:', err);
        }
      };
      fetchUserPlaylists();
    }
  }, [isLoggedIn, userProfile]);

  // Sync playing state with audio element
  useEffect(() => {
    if (!audioRef.current || !currentSong?.url) return;
    if (isPlaying) {
      audioRef.current.play().catch(err => console.error('Playback failed:', err));
    } else {
      audioRef.current.pause();
    }
  }, [isPlaying, currentSong?.url]);

  // QR Login Logic
  const startQrLogin = async () => {
    try {
      setLoginStep('qr');
      setQrStatus({ code: 801, message: '正在获取二维码...' });
      
      // 1. Get Key
      const keyRes = await fetch(`${API_BASE}/login/qr/key?timestamp=${Date.now()}`);
      const { data: { unikey } } = await keyRes.json();
      
      // 2. Create QR URL
      const qrRes = await fetch(`${API_BASE}/login/qr/create?key=${unikey}&qrimg=true&timestamp=${Date.now()}`);
      const { data: { qrurl } } = await qrRes.json();
      
      setQrCodeData({ key: unikey, url: qrurl });
      setQrStatus({ code: 801, message: '请使用网易云音乐APP扫码' });
      
      // 3. Start Polling
      if (pollTimerRef.current) clearInterval(pollTimerRef.current);
      pollTimerRef.current = setInterval(async () => {
        try {
          const checkRes = await fetch(`${API_BASE}/login/qr/check?key=${unikey}&timestamp=${Date.now()}`);
          const status = await checkRes.json();
          
          setQrStatus({ code: status.code, message: status.message });
          
          if (status.code === 803) {
            // Success!
            clearInterval(pollTimerRef.current!);
            handleLoginSuccess(status.cookie);
          } else if (status.code === 800) {
            // Expired
            clearInterval(pollTimerRef.current!);
          }
        } catch (err) {
          console.error('QR Check Error:', err);
        }
      }, 3000);
      
    } catch (err) {
      console.error('QR Login Error:', err);
      setQrStatus({ code: -1, message: '获取二维码失败，请重试' });
    }
  };

  const handleLoginSuccess = async (cookie: string) => {
    try {
      // Save cookie (in a real app, you'd handle this more securely)
      localStorage.setItem('netease_cookie', cookie);
      
      // Get User Info
      const statusRes = await fetch(`${API_BASE}/login/status?timestamp=${Date.now()}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cookie })
      });
      const statusData = await statusRes.json();
      
      if (statusData.data?.profile) {
        setUserProfile(statusData.data.profile);
      } else if (statusData.profile) {
        setUserProfile(statusData.profile);
      } else {
        throw new Error('Profile not found in response');
      }
    } catch (err) {
      console.error('Fetch profile error:', err);
      // Fallback profile if fetch fails but login succeeded
      setUserProfile({
        nickname: '网易云用户',
        avatarUrl: 'https://picsum.photos/seed/netease/200',
        userId: 0,
        level: 1,
        signature: '听见好时光'
      });
    } finally {
      setIsLoggedIn(true);
      setShowLoginModal(false);
      setActiveTab('mine');
    }
  };

  const handleLogout = () => {
    setIsLoggedIn(false);
    setUserProfile(null);
    localStorage.removeItem('netease_cookie');
  };

  // Search Logic
  useEffect(() => {
    const timer = setTimeout(async () => {
      if (!searchQuery.trim()) {
        setSearchResults([]);
        return;
      }
      
      setIsLoading(true);
      try {
        const res = await fetch(`${API_BASE}/cloudsearch?keywords=${encodeURIComponent(searchQuery)}`);
        const data = await res.json();
        const songs = data.result.songs.map((s: any) => ({
          id: s.id.toString(),
          title: s.name,
          artist: s.ar.map((a: any) => a.name).join('/'),
          album: s.al.name,
          cover: s.al.picUrl,
        }));
        setSearchResults(songs);
      } catch (err) {
        console.error('Search error:', err);
      } finally {
        setIsLoading(false);
      }
    }, 500);
    
    return () => clearTimeout(timer);
  }, [searchQuery]);

  const handlePlaySong = async (song: Song) => {
    try {
      // Get Real URL
      const res = await fetch(`${API_BASE}/song/url/v1?id=${song.id}&level=standard`);
      const data = await res.json();
      
      if (data.code !== 200 || !data.data || data.data.length === 0 || !data.data[0].url) {
        alert('暂无播放源，可能需要会员或版权限制');
        return;
      }
      const url = data.data[0].url;
      
      const songWithUrl = { ...song, url };
      setCurrentSong(songWithUrl);
      
      if (audioRef.current) {
        audioRef.current.src = url;
        setIsPlaying(true);
        setShowPlayer(true);
      }
    } catch (err) {
      console.error('Play song error:', err);
      alert('播放失败');
    }
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <motion.div 
      initial={{ opacity: 0, x: 100 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 100 }}
      className="absolute inset-0 bg-[#f8f8f8] flex flex-col z-[60] overflow-hidden"
    >
      {/* Header */}
      {!showPlayer && (
        <div className="pt-12 pb-2 px-4 flex items-center gap-4 bg-white sticky top-0 z-10 shadow-sm">
          <button onClick={onBack} className="text-zinc-800 active:scale-90 transition-transform">
            <Menu size={24} />
          </button>
          <div className="flex-1 bg-zinc-100 rounded-full px-4 py-2 flex items-center gap-2 border border-zinc-200 focus-within:bg-white focus-within:border-red-200 transition-all">
            <Search size={16} className="text-zinc-400" />
            <input 
              type="text" 
              placeholder="搜索歌曲、歌手、专辑" 
              className="bg-transparent outline-none text-[14px] w-full placeholder:text-zinc-400"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
          <button className="text-zinc-800 active:scale-90 transition-transform">
            <Mic2 size={22} />
          </button>
        </div>
      )}

      {/* Main Content */}
      {!showPlayer && (
        <div className="flex-1 overflow-y-auto pb-24">
          {searchQuery ? (
            <div className="p-4 space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-[14px] font-bold text-zinc-400">搜索结果</h3>
                {isLoading && <Loader2 size={16} className="animate-spin text-zinc-400" />}
              </div>
              {searchResults.length > 0 ? (
                searchResults.map(song => (
                  <div 
                    key={song.id} 
                    className="flex items-center gap-3 active:bg-zinc-100 p-2 rounded-xl transition-colors cursor-pointer"
                    onClick={() => handlePlaySong(song)}
                  >
                    <img src={song.cover} className="w-12 h-12 rounded-lg object-cover shadow-sm" />
                    <div className="flex-1 min-w-0">
                      <h4 className="text-[14px] font-bold text-zinc-900 truncate">{song.title}</h4>
                      <p className="text-[11px] text-zinc-500 truncate">{song.artist} - {song.album}</p>
                    </div>
                    <Play size={18} className="text-zinc-300" />
                  </div>
                ))
              ) : !isLoading && (
                <div className="text-center py-20 text-zinc-400 text-[14px]">未找到相关歌曲</div>
              )}
            </div>
          ) : activeTab === 'discover' ? (
            <>
              {/* Banner Placeholder */}
              <div className="px-4 mt-4">
                <div className="w-full h-36 bg-zinc-200 rounded-2xl shadow-lg flex items-center justify-center text-white font-bold text-xl overflow-hidden relative">
                  {banners.length > 0 ? (
                    <img src={banners[0].pic} className="absolute inset-0 w-full h-full object-cover" />
                  ) : (
                    <>
                      <img src="https://picsum.photos/seed/music-banner/800/400" className="absolute inset-0 w-full h-full object-cover opacity-60" />
                      <span className="relative z-10 drop-shadow-md">网易云音乐 · 乐动人心</span>
                    </>
                  )}
                </div>
              </div>

              {/* Quick Actions */}
              <div className="flex justify-around py-6 px-2">
                {[
                  { icon: <Radio className="text-red-500" />, label: '每日推荐' },
                  { icon: <ListMusic className="text-red-500" />, label: '歌单' },
                  { icon: <Library className="text-red-500" />, label: '排行榜' },
                  { icon: <Smartphone className="text-red-500" />, label: '直播' },
                  { icon: <Disc className="text-red-500" />, label: '数字专辑' },
                ].map((item, i) => (
                  <div key={i} className="flex flex-col items-center gap-1.5 active:scale-95 transition-transform cursor-pointer">
                    <div className="w-12 h-12 bg-red-50 rounded-full flex items-center justify-center shadow-sm">
                      {item.icon}
                    </div>
                    <span className="text-[11px] text-zinc-600 font-medium">{item.label}</span>
                  </div>
                ))}
              </div>

              {/* Recommended Songs */}
              <div className="px-4 mt-2">
                <div className="flex justify-between items-center mb-4">
                  <h2 className="text-[17px] font-bold text-zinc-900">推荐歌单</h2>
                  <button className="text-[12px] text-zinc-400 border border-zinc-200 px-3 py-1 rounded-full active:bg-zinc-50">更多 &gt;</button>
                </div>
                <div className="grid grid-cols-3 gap-3">
                  {recommendedPlaylists.length > 0 ? recommendedPlaylists.map((playlist: any) => (
                    <div key={playlist.id} className="flex flex-col gap-1.5 active:scale-95 transition-transform cursor-pointer">
                      <div className="aspect-square bg-zinc-200 rounded-xl overflow-hidden relative shadow-sm">
                        <img src={playlist.picUrl} className="w-full h-full object-cover" />
                        <div className="absolute top-1 right-1 bg-black/20 backdrop-blur-md px-1.5 py-0.5 rounded-full flex items-center gap-1">
                          <Play size={8} className="text-white fill-white" />
                          <span className="text-[8px] text-white font-bold">
                            {playlist.playCount > 10000 ? `${(playlist.playCount / 10000).toFixed(1)}万` : playlist.playCount}
                          </span>
                        </div>
                      </div>
                      <span className="text-[11px] text-zinc-700 leading-tight line-clamp-2">
                        {playlist.name}
                      </span>
                    </div>
                  )) : [1, 2, 3, 4, 5, 6].map(i => (
                    <div key={i} className="flex flex-col gap-1.5 active:scale-95 transition-transform cursor-pointer">
                      <div className="aspect-square bg-zinc-200 rounded-xl overflow-hidden relative shadow-sm">
                        <img src={`https://picsum.photos/seed/playlist-${i}/300`} className="w-full h-full object-cover" />
                        <div className="absolute top-1 right-1 bg-black/20 backdrop-blur-md px-1.5 py-0.5 rounded-full flex items-center gap-1">
                          <Play size={8} className="text-white fill-white" />
                          <span className="text-[8px] text-white font-bold">{(Math.random() * 100).toFixed(1)}万</span>
                        </div>
                      </div>
                      <span className="text-[11px] text-zinc-700 leading-tight line-clamp-2">
                        加载中...
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {/* New Songs */}
              <div className="px-4 mt-6 mb-24">
                <div className="flex justify-between items-center mb-4">
                  <h2 className="text-[17px] font-bold text-zinc-900">最新音乐</h2>
                  <button className="text-[12px] text-zinc-400 border border-zinc-200 px-3 py-1 rounded-full active:bg-zinc-50">播放全部</button>
                </div>
                <div className="space-y-4">
                  {(newSongs.length > 0 ? newSongs : []).map(song => (
                    <div 
                      key={song.id} 
                      className="flex items-center gap-3 active:bg-zinc-100 p-1 rounded-xl transition-colors cursor-pointer"
                      onClick={() => handlePlaySong(song)}
                    >
                      <img src={song.cover} className="w-12 h-12 rounded-lg object-cover shadow-sm" />
                      <div className="flex-1 min-w-0">
                        <h4 className="text-[14px] font-bold text-zinc-900 truncate">{song.title}</h4>
                        <p className="text-[11px] text-zinc-500 truncate">{song.artist} - {song.album}</p>
                      </div>
                      <button className="text-zinc-300 active:text-red-500 transition-colors">
                        <Play size={18} />
                      </button>
                      <button className="text-zinc-300">
                        <MoreVertical size={18} />
                      </button>
                    </div>
                  ))}
                  {newSongs.length === 0 && (
                    <div className="text-center py-10 text-zinc-400 text-[13px]">加载中...</div>
                  )}
                </div>
              </div>
            </>
          ) : activeTab !== 'mine' ? (
            <div className="flex flex-col items-center justify-center h-64 text-zinc-400 mt-20">
              <div className="w-16 h-16 bg-zinc-100 rounded-full flex items-center justify-center mb-4">
                {activeTab === 'podcast' && <Radio size={24} className="text-zinc-400" />}
                {activeTab === 'follow' && <Users size={24} className="text-zinc-400" />}
                {activeTab === 'community' && <MessageCircle size={24} className="text-zinc-400" />}
              </div>
              <p className="text-[14px] font-medium">
                {activeTab === 'podcast' && '播客功能开发中'}
                {activeTab === 'follow' && '关注动态开发中'}
                {activeTab === 'community' && '云村社区开发中'}
              </p>
              <p className="text-[12px] mt-1 opacity-60">敬请期待后续更新</p>
            </div>
          ) : null}
        </div>
      )}

      {/* Bottom Navigation */}
      {!showPlayer && (
        <div className="h-16 bg-white/80 backdrop-blur-xl px-4 flex items-center justify-between sticky bottom-0 z-20 pb-0">
          {[
            { id: 'discover', icon: <Disc />, label: '发现' },
            { id: 'podcast', icon: <Radio />, label: '播客' },
            { id: 'mine', icon: <User />, label: '我的', onClick: () => !isLoggedIn && setShowLoginModal(true) },
            { id: 'follow', icon: <Users />, label: '关注' },
            { id: 'community', icon: <MessageCircle />, label: '社区' },
          ].map((item) => (
            <button 
              key={item.id}
              onClick={() => {
                if (item.onClick) item.onClick();
                setActiveTab(item.id as any);
              }}
              className={`flex flex-col items-center gap-1 ${activeTab === item.id ? 'text-red-500' : 'text-zinc-400'}`}
            >
              <div className={activeTab === item.id ? 'scale-110 transition-transform' : ''}>
                {item.icon}
              </div>
              <span className="text-[10px] font-medium">{item.label}</span>
            </button>
          ))}
        </div>
      )}

      {/* Mini Player */}
      {!showPlayer && currentSong && (
        <div 
          className="fixed bottom-20 left-4 right-4 h-14 bg-white/90 backdrop-blur-xl rounded-full shadow-2xl border border-zinc-100 flex items-center px-2 gap-3 z-30 cursor-pointer"
          onClick={() => setShowPlayer(true)}
        >
          <div className={`w-10 h-10 rounded-full bg-zinc-900 border-2 border-zinc-800 flex items-center justify-center overflow-hidden shrink-0 ${isPlaying ? 'animate-[spin_8s_linear_infinite]' : ''}`}>
            <img src={currentSong.cover} className="w-full h-full object-cover" />
          </div>
          <div className="flex-1 min-w-0">
            <h5 className="text-[13px] font-bold text-zinc-900 truncate">{currentSong.title}</h5>
            <p className="text-[10px] text-zinc-500 truncate">{currentSong.artist}</p>
          </div>
          <div className="flex items-center gap-3 pr-2">
            <button onClick={(e) => { e.stopPropagation(); setIsPlaying(!isPlaying); }}>
              {isPlaying ? <Pause size={20} className="text-zinc-800" /> : <Play size={20} className="text-zinc-800 fill-zinc-800" />}
            </button>
            <button onClick={(e) => e.stopPropagation()}>
              <ListMusic size={20} className="text-zinc-800" />
            </button>
          </div>
        </div>
      )}

      {/* Full Player View */}
      <AnimatePresence>
        {showPlayer && currentSong && (
          <motion.div 
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            className="absolute inset-0 bg-[#2c2c2c] z-[100] flex flex-col text-white"
          >
            {/* Background Blur */}
            <div className="absolute inset-0 z-0">
              <img src={currentSong.cover} className="w-full h-full object-cover blur-[100px] opacity-40 scale-150" />
              <div className="absolute inset-0 bg-black/40" />
            </div>

            {/* Header */}
            <div className="relative z-10 pt-12 px-6 flex items-center justify-between">
              <button onClick={() => setShowPlayer(false)}>
                <ChevronLeft size={28} />
              </button>
              <div className="flex flex-col items-center flex-1 min-w-0 px-4">
                <h2 className="text-[16px] font-bold truncate w-full text-center">{currentSong.title}</h2>
                <p className="text-[12px] opacity-60 truncate w-full text-center">{currentSong.artist} &gt;</p>
              </div>
              <button>
                <Share2 size={24} />
              </button>
            </div>

            {/* Vinyl Record */}
            <div className="relative z-10 flex-1 flex flex-col items-center justify-center">
              <div className="relative">
                {/* Needle */}
                <div 
                  className={`absolute -top-12 left-1/2 -translate-x-1/2 w-24 h-36 z-20 origin-top transition-transform duration-700 ${isPlaying ? 'rotate-[20deg]' : 'rotate-0'}`}
                  style={{ transformOrigin: '20px 20px' }}
                >
                  <div className="w-full h-full bg-contain bg-no-repeat bg-center" style={{ backgroundImage: 'url(https://s2.music.126.net/style/web2/img/needle.png)' }} />
                </div>
                
                {/* Record */}
                <div className={`w-72 h-72 rounded-full bg-zinc-950 border-[12px] border-zinc-900/50 shadow-2xl flex items-center justify-center relative ${isPlaying ? 'animate-[spin_12s_linear_infinite]' : ''}`}>
                  <div className="absolute inset-0 rounded-full border border-white/5 opacity-20" />
                  <div className="absolute inset-4 rounded-full border border-white/5 opacity-20" />
                  <div className="absolute inset-8 rounded-full border border-white/5 opacity-20" />
                  <div className="w-[65%] h-[65%] rounded-full overflow-hidden border-4 border-black/40 shadow-inner">
                    <img src={currentSong.cover} className="w-full h-full object-cover" />
                  </div>
                </div>
              </div>
            </div>

            {/* Controls */}
            <div className="relative z-10 px-8 pb-16 space-y-8">
              {/* Action Buttons */}
              <div className="flex justify-around opacity-80">
                <Heart size={24} className="hover:text-red-500 transition-colors" />
                <Download size={24} />
                <Mic2 size={24} />
                <MessageCircle size={24} />
                <MoreVertical size={24} />
              </div>

              {/* Progress Bar */}
              <div className="space-y-2">
                <div className="h-1 bg-white/20 rounded-full relative overflow-hidden">
                  <div 
                    className="absolute inset-y-0 left-0 bg-white/60 transition-all duration-300" 
                    style={{ width: `${(currentTime / duration) * 100}%` }}
                  />
                </div>
                <div className="flex justify-between text-[10px] opacity-40 font-medium">
                  <span>{formatTime(currentTime)}</span>
                  <span>{formatTime(duration)}</span>
                </div>
              </div>

              {/* Playback Controls */}
              <div className="flex items-center justify-between">
                <button className="opacity-60"><Radio size={24} /></button>
                <button className="active:scale-90 transition-transform"><SkipBack size={32} className="fill-current" /></button>
                <button 
                  onClick={() => setIsPlaying(!isPlaying)}
                  className="w-16 h-16 bg-white/10 rounded-full flex items-center justify-center border border-white/20 active:scale-95 transition-transform"
                >
                  {isPlaying ? <Pause size={32} className="fill-current" /> : <Play size={32} className="fill-current ml-1" />}
                </button>
                <button className="active:scale-90 transition-transform"><SkipForward size={32} className="fill-current" /></button>
                <button className="opacity-60"><ListMusic size={24} /></button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Login Modal */}
      <AnimatePresence>
        {showLoginModal && (
          <div className="absolute inset-0 z-[200] flex items-end justify-center bg-black/40 backdrop-blur-sm">
            <motion.div 
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              className="w-full bg-white rounded-t-[32px] p-8 flex flex-col items-center gap-8 shadow-2xl"
            >
              <div className="w-12 h-1.5 bg-zinc-200 rounded-full" />
              
              {loginStep === 'choice' ? (
                <>
                  <div className="w-20 h-20 bg-red-500 rounded-2xl flex items-center justify-center shadow-lg shadow-red-500/20">
                    <Disc size={48} className="text-white" />
                  </div>
                  <div className="text-center space-y-2">
                    <h3 className="text-[20px] font-bold text-zinc-900">登录网易云音乐</h3>
                    <p className="text-[13px] text-zinc-500">登录后即可同步您的歌单和听歌记录</p>
                  </div>

                  <div className="w-full space-y-3">
                    <button 
                      onClick={startQrLogin}
                      className="w-full py-4 bg-red-500 text-white rounded-full font-bold text-[15px] shadow-lg shadow-red-500/20 active:scale-[0.98] transition-transform flex items-center justify-center gap-2"
                    >
                      <QrCode size={18} /> 扫码登录
                    </button>
                    <button 
                      disabled
                      className="w-full py-4 bg-zinc-100 text-zinc-400 rounded-full font-bold text-[15px] flex items-center justify-center gap-2 cursor-not-allowed"
                    >
                      <Smartphone size={18} /> 手机号登录 (暂未开放)
                    </button>
                  </div>
                </>
              ) : (
                <div className="w-full flex flex-col items-center gap-6">
                  <h3 className="text-[18px] font-bold text-zinc-900">扫码登录</h3>
                  <div className="p-4 bg-white border border-zinc-100 rounded-2xl shadow-inner relative">
                    {qrCodeData ? (
                      <QRCodeSVG value={qrCodeData.url} size={180} />
                    ) : (
                      <div className="w-[180px] h-[180px] flex items-center justify-center">
                        <Loader2 className="animate-spin text-red-500" size={32} />
                      </div>
                    )}
                    {qrStatus.code === 800 && (
                      <div className="absolute inset-0 bg-white/90 flex flex-col items-center justify-center gap-2 rounded-2xl">
                        <span className="text-[12px] text-zinc-500">二维码已失效</span>
                        <button onClick={startQrLogin} className="text-red-500 font-bold flex items-center gap-1">
                          <RefreshCw size={14} /> 刷新
                        </button>
                      </div>
                    )}
                  </div>
                  <div className="text-center space-y-1">
                    <p className={`text-[14px] font-bold ${qrStatus.code === 802 ? 'text-green-500' : 'text-zinc-800'}`}>
                      {qrStatus.message}
                    </p>
                    <p className="text-[12px] text-zinc-400">使用网易云音乐APP扫码</p>
                  </div>
                  <button onClick={() => setLoginStep('choice')} className="text-zinc-500 text-[13px]">返回选择其他方式</button>
                </div>
              )}

              <button onClick={() => setShowLoginModal(false)} className="text-[13px] text-zinc-400 font-medium pb-4">暂不登录</button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Logged In Profile View (Mine Tab) */}
      {!showPlayer && activeTab === 'mine' && isLoggedIn && userProfile && (
        <div className="absolute inset-0 top-14 bg-[#f8f8f8] z-20 overflow-y-auto pb-24">
          <div className="p-4 space-y-6">
            {/* User Profile Card */}
            <div className="bg-white rounded-2xl p-4 flex items-center gap-4 shadow-sm">
              <img src={userProfile.avatarUrl} className="w-16 h-16 rounded-full border-2 border-white shadow-md" />
              <div className="flex-1">
                <h3 className="text-[18px] font-bold text-zinc-900">{userProfile.nickname}</h3>
                <div className="flex items-center gap-2 mt-1">
                  <span className="px-2 py-0.5 bg-zinc-100 text-zinc-500 text-[10px] rounded-full">Lv.{userProfile.level || 0}</span>
                  <span className="text-[11px] text-zinc-400 truncate max-w-[150px]">{userProfile.signature || '暂无签名'}</span>
                </div>
              </div>
              <button onClick={handleLogout} className="text-zinc-400 p-2 active:text-red-500">
                <LogOut size={20} />
              </button>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-4 gap-4">
              {[
                { label: '本地音乐', count: 0 },
                { label: '云盘', count: '-' },
                { label: '已购', count: '-' },
                { label: '最近播放', count: '-' },
              ].map((item, i) => (
                <div key={i} className="bg-white rounded-xl p-3 flex flex-col items-center gap-1 shadow-sm">
                  <span className="text-[14px] font-bold text-zinc-900">{item.count}</span>
                  <span className="text-[10px] text-zinc-400">{item.label}</span>
                </div>
              ))}
            </div>

            {/* Playlists Placeholder */}
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <h3 className="text-[16px] font-bold text-zinc-900">我的歌单 <span className="text-zinc-400 font-normal">({userPlaylists.length})</span></h3>
                <Plus size={20} className="text-zinc-400" />
              </div>
              {userPlaylists.length > 0 ? (
                <div className="space-y-3">
                  {userPlaylists.map((list: any) => (
                    <div key={list.id} className="flex items-center gap-3 bg-white p-2 rounded-xl shadow-sm active:scale-[0.98] transition-transform cursor-pointer">
                      <img src={list.coverImgUrl} className="w-12 h-12 rounded-lg object-cover" />
                      <div className="flex-1 min-w-0">
                        <h4 className="text-[14px] font-bold text-zinc-900 truncate">{list.name}</h4>
                        <p className="text-[11px] text-zinc-400 truncate">{list.trackCount}首</p>
                      </div>
                      <MoreVertical size={18} className="text-zinc-300" />
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-10 text-zinc-400 text-[13px] bg-white rounded-2xl border border-dashed border-zinc-200">
                  歌单加载中...
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </motion.div>
  );
}
