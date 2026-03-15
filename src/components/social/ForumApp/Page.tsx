import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Search, Bell, User, PenSquare, Heart, MessageCircle, Share2, 
  MoreHorizontal, ChevronLeft, Image as ImageIcon, Send, X, 
  ThumbsUp, Flag, Trash2, Edit2, MessageSquare, Flame, Clock,
  Camera, Check, LogOut, Key, Settings, Repeat, BarChart2, Feather,
  CheckCircle2, ArrowLeft, Home, Mail, Plus, Bookmark, Link2, AlertTriangle
} from 'lucide-react';
import { AppDataExtended, ForumPost, ForumComment, ForumNotification, UserProfileExtended, Character } from '../../../types';
import { extractImageUrls } from '../../../utils';

// Mock Users
const MOCK_USERS: Record<string, { name: string; avatar: string }> = {
  'user_8888': { name: '瓜田守望者', avatar: 'https://picsum.photos/seed/gua1/100' },
  'user_9999': { name: '娱乐圈纪检委', avatar: 'https://picsum.photos/seed/gua2/100' },
  'user_7777': { name: '吃瓜群众小王', avatar: 'https://picsum.photos/seed/gua3/100' },
  'user_6666': { name: '前线记者李', avatar: 'https://picsum.photos/seed/gua4/100' },
  'user_5555': { name: '路人甲', avatar: 'https://picsum.photos/seed/gua5/100' },
  'user_4444': { name: '深扒君', avatar: 'https://picsum.photos/seed/gua6/100' },
  'user_3333': { name: '内幕爆料人', avatar: 'https://picsum.photos/seed/gua7/100' },
  'user_2222': { name: '理智粉', avatar: 'https://picsum.photos/seed/gua8/100' },
};

// Mock Data for initial state
const MOCK_POSTS: ForumPost[] = [
  {
    id: 'post-1',
    authorId: 'user_4444',
    title: '【独家】某顶流恋情曝光？多图预警！',
    content: '昨天在三里屯偶遇某顶流和一神秘女子逛街，举止亲密。看图！这要是真的，微博又要瘫痪了吧？大家怎么看？',
    images: ['https://picsum.photos/seed/gossip1/500/300', 'https://picsum.photos/seed/gossip2/500/300'],
    category: '全部',
    timestamp: Date.now() - 1000 * 60 * 30,
    viewCount: 12050,
    likes: ['user_8888', 'user_9999', 'user_7777', 'user_6666'],
    collections: ['user_8888'],
    comments: [
      {
        id: 'c1',
        postId: 'post-1',
        authorId: 'user_8888',
        content: '卧槽！真的假的？房子塌了啊！',
        timestamp: Date.now() - 1000 * 60 * 25,
        likes: ['user_7777'],
        rootCommentId: 'c1'
      },
      {
        id: 'c2',
        postId: 'post-1',
        authorId: 'user_2222',
        content: '非官宣不约，抱走我家哥哥。',
        timestamp: Date.now() - 1000 * 60 * 20,
        likes: [],
        rootCommentId: 'c2'
      }
    ]
  },
  {
    id: 'post-2',
    authorId: 'user_3333',
    title: '理性讨论，最近那个很火的剧是不是注水了？',
    content: '看了前几集还行，后面剧情越来越拖沓，配角戏份比主角还多。编剧是江郎才尽了吗？',
    category: '全部',
    timestamp: Date.now() - 1000 * 60 * 60 * 2,
    viewCount: 5600,
    likes: ['user_9999', 'user_5555'],
    collections: [],
    comments: [
      {
        id: 'c3',
        postId: 'post-2',
        authorId: 'user_9999',
        content: '确实，我也觉得后面有点崩。',
        timestamp: Date.now() - 1000 * 60 * 50,
        likes: ['user_3333'],
        rootCommentId: 'c3'
      }
    ]
  },
  {
    id: 'post-3',
    authorId: 'user_8888',
    title: '818那些年我们追过的意难平CP',
    content: '既然都在吃瓜，不如来聊聊那些让你意难平的CP。我先来：仙剑一的逍遥灵儿！',
    images: ['https://picsum.photos/seed/cp/500/300'],
    category: '全部',
    timestamp: Date.now() - 1000 * 60 * 60 * 5,
    viewCount: 3420,
    likes: ['user_5555', 'user_6666', 'user_7777'],
    collections: ['user_5555'],
    comments: []
  },
  {
    id: 'post-4',
    authorId: 'user_6666',
    title: '某网红店排队3小时，就这？',
    content: '今天去打卡了那家很火的火锅店，排队排到腿软，结果味道也就那样，服务还一般。避雷避雷！',
    category: '全部',
    timestamp: Date.now() - 1000 * 60 * 60 * 24,
    viewCount: 1280,
    likes: ['user_7777'],
    collections: [],
    comments: []
  }
];

type ForumAppProps = {
  appData: AppDataExtended;
  onUpdateAppData: (newData: AppDataExtended) => void;
  onClose: () => void;
  onOpenChat?: (characterId: string) => void;
  initialPostId?: string | null;
};

type ForumCommentItemProps = {
  comment: ForumComment;
  post: ForumPost;
  depth?: number;
  currentUser: UserProfileExtended;
  followedUsers: string[];
  getAuthor: (id: string) => any;
  onReply: (postId: string, content: string, replyToId?: string, rootId?: string) => void;
  onLike: (postId: string, commentId: string) => void;
  onDelete: (postId: string, commentId: string) => void;
  onReport: () => void;
  onUserClick: (userId: string) => void;
  onFollow: (userId: string) => void;
};

const ForumCommentItem: React.FC<ForumCommentItemProps> = ({ 
  comment, post, depth = 0, currentUser, followedUsers, 
  getAuthor, onReply, onLike, onDelete, onReport, onUserClick, onFollow 
}) => {
    const author = getAuthor(comment.authorId);
    const handle = `@${author.id.replace('user_', 'u').replace('char_', 'c')}`;
    const isOwner = comment.authorId === currentUser.id;
    const [showReply, setShowReply] = useState(false);
    const [replyText, setReplyText] = useState('');
    const [showPostMenu, setShowPostMenu] = useState<string | null>(null);
    const replies = post.comments.filter(c => c.replyToId === comment.id);

    const postDate = new Date(comment.timestamp);
    const now = new Date();
    const diffMs = now.getTime() - postDate.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);
    let timeStr = '';
    if (diffMins < 1) timeStr = '刚刚';
    else if (diffMins < 60) timeStr = `${diffMins}分钟`;
    else if (diffHours < 24) timeStr = `${diffHours}小时`;
    else if (diffDays < 365) timeStr = postDate.toLocaleDateString('zh-CN', { month: 'short', day: 'numeric' });
    else timeStr = postDate.toLocaleDateString('zh-CN', { year: 'numeric', month: 'short', day: 'numeric' });

    return (
      <div className={`flex gap-2.5 px-4 py-2 border-b border-zinc-100 ${depth > 0 ? 'mt-1 border-l-2 border-l-zinc-100 pl-3 border-b-0' : ''}`}>
        <img 
          src={author.avatar} 
          className="w-8 h-8 rounded-full object-cover shrink-0 cursor-pointer" 
          onClick={(e) => {
            e.stopPropagation();
            onUserClick(author.id);
          }}
        />
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1 text-[13px] truncate">
              <span className="font-bold text-zinc-900 truncate hover:underline">{author.name}</span>
              {author.id !== 'user_8888' && <CheckCircle2 size={12} className="text-zinc-900 fill-zinc-900 shrink-0" />}
              <span className="text-zinc-500 truncate">{handle}</span>
              <span className="text-zinc-500">·</span>
              <span className="text-zinc-500 hover:underline">{timeStr}</span>
            </div>
            <div className="relative">
              <button 
                onClick={(e) => {
                  e.stopPropagation();
                  setShowPostMenu(showPostMenu === comment.id ? null : comment.id);
                }}
                className="text-zinc-400 hover:text-zinc-900 hover:bg-zinc-100 p-1 rounded-full transition-colors -mr-1"
              >
                <MoreHorizontal size={16} />
              </button>
              {showPostMenu === comment.id && (
                <>
                  <div className="fixed inset-0 z-40" onClick={(e) => { e.stopPropagation(); setShowPostMenu(null); }} />
                  <div className="absolute right-0 top-full mt-1 w-32 bg-white rounded-xl shadow-lg border border-zinc-100 py-1 z-50 overflow-hidden">
                    <button 
                      onClick={(e) => {
                        e.stopPropagation();
                        navigator.clipboard.writeText(window.location.href);
                        alert('链接已复制');
                        setShowPostMenu(null);
                      }}
                      className="w-full px-3 py-2 text-left text-[13px] hover:bg-zinc-50 flex items-center gap-2"
                    >
                      <Link2 size={14} />
                      复制链接
                    </button>
                    {isOwner ? (
                      <button 
                        onClick={(e) => {
                          e.stopPropagation();
                          onDelete(post.id, comment.id);
                          setShowPostMenu(null);
                        }}
                        className="w-full px-3 py-2 text-left text-[13px] text-red-500 hover:bg-red-50 flex items-center gap-2"
                      >
                        <Trash2 size={14} />
                        删除
                      </button>
                    ) : (
                      <button 
                        onClick={(e) => {
                          e.stopPropagation();
                          onReport();
                          setShowPostMenu(null);
                        }}
                        className="w-full px-3 py-2 text-left text-[13px] text-red-500 hover:bg-red-50 flex items-center gap-2"
                      >
                        <AlertTriangle size={14} />
                        举报
                      </button>
                    )}
                  </div>
                </>
              )}
            </div>
          </div>
          
          <p className="text-[14px] text-zinc-900 mt-0.5 whitespace-pre-wrap leading-snug">{comment.content}</p>

          <div className="flex items-center justify-between mt-2 text-zinc-500 max-w-md pr-2">
            <button 
              onClick={() => setShowReply(!showReply)}
              className="flex items-center gap-1 hover:text-zinc-900 group transition-colors"
            >
              <div className="p-1 rounded-full group-hover:bg-zinc-100 transition-colors -ml-1">
                <MessageCircle size={16} />
              </div>
              <span className="text-[12px]">{replies.length > 0 ? replies.length : ''}</span>
            </button>
            <button className="flex items-center gap-1 hover:text-green-500 group transition-colors">
              <div className="p-1 rounded-full group-hover:bg-green-50 transition-colors -ml-1">
                <Repeat size={16} />
              </div>
            </button>
            <button 
              onClick={() => onLike(post.id, comment.id)}
              className={`flex items-center gap-1 group transition-colors ${comment.likes.includes(currentUser.id) ? 'text-pink-500' : 'hover:text-pink-500'}`}
            >
              <div className="p-1 rounded-full group-hover:bg-pink-50 transition-colors -ml-1">
                <Heart size={16} className={comment.likes.includes(currentUser.id) ? 'fill-pink-500' : ''} />
              </div>
              <span className="text-[12px]">{comment.likes.length > 0 ? comment.likes.length : ''}</span>
            </button>
            <button className="flex items-center gap-1 hover:text-zinc-900 group transition-colors">
              <div className="p-1 rounded-full group-hover:bg-zinc-100 transition-colors -ml-1">
                <BarChart2 size={16} />
              </div>
            </button>
            <div className="flex items-center gap-2">
              <button className="flex items-center gap-1 hover:text-zinc-900 group transition-colors">
                <div className="p-1 rounded-full group-hover:bg-zinc-100 transition-colors -ml-1">
                  <Share2 size={16} />
                </div>
              </button>
            </div>
          </div>

          {showReply && (
            <div className="mt-3 flex gap-3 items-center">
              <img src={currentUser.avatar} className="w-8 h-8 rounded-full object-cover" />
              <input 
                type="text" 
                value={replyText}
                onChange={(e) => setReplyText(e.target.value)}
                placeholder="发布你的回复"
                className="flex-1 bg-transparent text-[14px] outline-none placeholder-zinc-500"
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && replyText.trim()) {
                    onReply(post.id, replyText.trim(), comment.id, comment.rootCommentId || comment.id);
                    setReplyText('');
                    setShowReply(false);
                  }
                }}
              />
              <button 
                onClick={() => {
                  if (replyText.trim()) {
                    onReply(post.id, replyText.trim(), comment.id, comment.rootCommentId || comment.id);
                    setReplyText('');
                    setShowReply(false);
                  }
                }}
                disabled={!replyText.trim()}
                className={`px-4 py-1.5 rounded-full font-bold text-[14px] transition-all ${replyText.trim() ? 'bg-zinc-900 text-white' : 'bg-zinc-200 text-zinc-400 cursor-not-allowed'}`}
              >
                回复
              </button>
            </div>
          )}

          {/* Nested Replies */}
          {replies.length > 0 && (
            <div className="mt-2 w-full">
              {replies.map(reply => (
                <ForumCommentItem 
                  key={reply.id} 
                  comment={reply} 
                  post={post} 
                  depth={depth + 1} 
                  currentUser={currentUser}
                  followedUsers={followedUsers}
                  getAuthor={getAuthor}
                  onReply={onReply}
                  onLike={onLike}
                  onDelete={onDelete}
                  onReport={onReport}
                  onUserClick={onUserClick}
                  onFollow={onFollow}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    );
};

export default function ForumApp({ appData, onUpdateAppData, onClose, onOpenChat, initialPostId }: ForumAppProps) {
  const [activeTab, setActiveTab] = useState<'home' | 'hot' | 'notification' | 'profile'>('home');
  const [currentView, setCurrentView] = useState<'list' | 'detail' | 'editor' | 'edit-profile' | 'user-profile'>('list');
  const [selectedPostId, setSelectedPostId] = useState<string | null>(null);

  useEffect(() => {
    if (initialPostId) {
      setSelectedPostId(initialPostId);
      setCurrentView('detail');
    }
  }, [initialPostId]);
  const [editingPostId, setEditingPostId] = useState<string | null>(null);
  const [viewingUserId, setViewingUserId] = useState<string | null>(null);
  const [homeFilter, setHomeFilter] = useState<'latest' | 'hot'>('latest');
  const [searchQuery, setSearchQuery] = useState('');
  
  // Editor State
  const [editorTitle, setEditorTitle] = useState('');
  const [editorContent, setEditorContent] = useState('');
  const [editorImages, setEditorImages] = useState<string[]>([]);
  const [showUrlInput, setShowUrlInput] = useState(false);
  const [urlInput, setUrlInput] = useState('');

  // Profile Edit State
  const [editName, setEditName] = useState('');
  const [editBio, setEditBio] = useState('');
  const [editAvatar, setEditAvatar] = useState('');

  // Post Detail State
  const [mainReplyText, setMainReplyText] = useState('');
  const [showPostMenu, setShowPostMenu] = useState<string | null>(null);

  // Share State
  const [showShareModal, setShowShareModal] = useState<string | null>(null);

  const currentUser = appData.userProfile;
  const posts = appData.forumData?.posts || MOCK_POSTS;
  const notifications = appData.forumData?.notifications || [];
  const followedUsers = appData.forumData?.followedUsers || [];

  // Initialize forum data if empty
  useEffect(() => {
    if (!appData.forumData) {
      onUpdateAppData({
        ...appData,
        forumData: {
          posts: MOCK_POSTS,
          notifications: [],
          followedUsers: []
        }
      });
    }
  }, []);

  const getAuthor = (id: string) => {
    if (id === currentUser.id) return currentUser;
    const character = appData.characters.find(c => c.id === id);
    if (character) return character;
    
    const mockUser = MOCK_USERS[id];
    if (mockUser) return { id, ...mockUser };

    return {
      id,
      name: `用户${id.slice(-4)}`,
      avatar: `https://picsum.photos/seed/${id}/100`
    };
  };

  const handleShareToChat = (postId: string, characterId: string) => {
    const post = posts.find(p => p.id === postId);
    if (!post) return;

    const shareContent = `[分享动态] ${post.content.slice(0, 50)}${post.content.length > 50 ? '...' : ''}`;

    // Cast appData to access chatHistory which is present in AppData but not AppDataExtended
    const fullAppData = appData as any;
    const currentHistory = fullAppData.chatHistory?.[characterId] || [];
    
    const newMessage = {
      role: 'user',
      text: shareContent,
      timestamp: Date.now(),
      needsReply: true,
      sharedPost: {
        id: post.id,
        title: post.title || post.content.slice(0, 20),
        content: post.content,
        images: post.images,
        authorName: getAuthor(post.authorId).name,
        authorAvatar: getAuthor(post.authorId).avatar
      }
    };

    const newHistory = [...currentHistory, newMessage];

    // Update appData to trigger state change and update last message
    const updatedCharacters = appData.characters.map(c => {
      if (c.id === characterId) {
        return {
          ...c,
          lastMessage: shareContent,
          lastTime: Date.now()
        };
      }
      return c;
    });

    onUpdateAppData({
      ...appData,
      // @ts-ignore - chatHistory is not in AppDataExtended but is in AppData
      chatHistory: {
        ...fullAppData.chatHistory,
        [characterId]: newHistory
      },
      characters: updatedCharacters
    });
    
    if (onOpenChat) {
      onOpenChat(characterId);
      setShowShareModal(null);
    }
  };

  const handleRepost = (postId: string) => {
    const originalPost = posts.find(p => p.id === postId);
    if (!originalPost) return;

    const newPost: ForumPost = {
      id: `post-${Date.now()}`,
      authorId: currentUser.id,
      title: '',
      content: `转发动态：\n${originalPost.content.slice(0, 50)}${originalPost.content.length > 50 ? '...' : ''}`,
      images: [], // Usually reposts might reference the original, but for simplicity we just quote text
      category: '全部',
      timestamp: Date.now(),
      viewCount: 0,
      likes: [],
      collections: [],
      comments: []
    };
    
    // Increment collection count on original post as a proxy for "repost" count in this data model
    const newPosts = posts.map(p => {
        if (p.id === postId) {
            return { ...p, collections: [...p.collections, currentUser.id] };
        }
        return p;
    });
    
    updatePosts([newPost, ...newPosts]);
    setShowShareModal(null);
    alert('转发成功');
  };

  const handleLikePost = (postId: string) => {
    const newPosts = posts.map(p => {
      if (p.id === postId) {
        const isLiked = p.likes.includes(currentUser.id);
        const newLikes = isLiked 
          ? p.likes.filter(id => id !== currentUser.id)
          : [...p.likes, currentUser.id];
        
        // Notify author if liked
        if (!isLiked && p.authorId !== currentUser.id) {
          addNotification(p.authorId, 'like_post', currentUser.id, postId);
        }
        
        return { ...p, likes: newLikes };
      }
      return p;
    });
    updatePosts(newPosts);
  };

  const handleCollectPost = (postId: string) => {
    const newPosts = posts.map(p => {
      if (p.id === postId) {
        const isCollected = p.collections.includes(currentUser.id);
        const newCollections = isCollected
          ? p.collections.filter(id => id !== currentUser.id)
          : [...p.collections, currentUser.id];
        return { ...p, collections: newCollections };
      }
      return p;
    });
    updatePosts(newPosts);
  };

  const handleDeletePost = (postId: string) => {
    if (confirm('确定要删除这篇帖子吗？')) {
      const newPosts = posts.filter(p => p.id !== postId);
      updatePosts(newPosts);
      if (selectedPostId === postId) {
        setCurrentView('list');
        setSelectedPostId(null);
      }
    }
  };

  const handleReport = () => {
    alert('已举报，感谢您的反馈！');
  };

  const handlePublish = () => {
    if (!editorTitle.trim() || !editorContent.trim()) return;

    if (editingPostId) {
      // Update existing post
      const newPosts = posts.map(p => {
        if (p.id === editingPostId) {
          return {
            ...p,
            title: editorTitle,
            content: editorContent,
            images: editorImages,
            category: '全部',
            timestamp: Date.now() // Update timestamp or keep original? Usually keep original or add edited time.
          };
        }
        return p;
      });
      updatePosts(newPosts);
    } else {
      // Create new post
      const newPost: ForumPost = {
        id: `post-${Date.now()}`,
        authorId: currentUser.id,
        title: editorTitle,
        content: editorContent,
        images: editorImages,
        category: '全部',
        timestamp: Date.now(),
        viewCount: 0,
        likes: [],
        collections: [],
        comments: []
      };
      updatePosts([newPost, ...posts]);
    }
    
    setCurrentView('list');
    setEditingPostId(null);
    setEditorTitle('');
    setEditorContent('');
    setEditorImages([]);
    setShowUrlInput(false);
    setUrlInput('');
  };

  const handleUserClick = (userId: string) => {
    if (userId !== currentUser.id) {
      setViewingUserId(userId);
      setCurrentView('user-profile');
    } else {
      setActiveTab('profile');
    }
  };

  const handleFollow = (userId: string) => {
    const isFollowed = followedUsers.includes(userId);
    const newFollowed = isFollowed 
      ? followedUsers.filter(id => id !== userId)
      : [...followedUsers, userId];
    
    onUpdateAppData({
      ...appData,
      forumData: {
        ...appData.forumData!,
        followedUsers: newFollowed
      }
    });
  };

  const handleComment = (postId: string, content: string, replyToId?: string, rootCommentId?: string) => {
    const newPosts = posts.map(p => {
      if (p.id === postId) {
        const newComment: ForumComment = {
          id: `c-${Date.now()}`,
          postId,
          authorId: currentUser.id,
          content,
          timestamp: Date.now(),
          likes: [],
          replyToId,
          rootCommentId: rootCommentId || (replyToId ? undefined : `c-${Date.now()}`) // If reply, use passed root, else self is root
        };
        
        // Fix rootCommentId for top-level comment
        if (!replyToId) {
            newComment.rootCommentId = newComment.id;
        }

        // Notify
        if (replyToId) {
           // Notify comment author
           const parentComment = p.comments.find(c => c.id === replyToId);
           if (parentComment && parentComment.authorId !== currentUser.id) {
             addNotification(parentComment.authorId, 'reply', currentUser.id, postId, newComment.id);
           }
        } else {
           // Notify post author
           if (p.authorId !== currentUser.id) {
             addNotification(p.authorId, 'reply', currentUser.id, postId, newComment.id);
           }
        }

        return { ...p, comments: [...p.comments, newComment] };
      }
      return p;
    });
    updatePosts(newPosts);
  };

  const handleDeleteComment = (postId: string, commentId: string) => {
    if (confirm('确定要删除这条评论吗？')) {
      const newPosts = posts.map(p => {
        if (p.id === postId) {
          return { ...p, comments: p.comments.filter(c => c.id !== commentId) };
        }
        return p;
      });
      updatePosts(newPosts);
    }
  };

  const handleLikeComment = (postId: string, commentId: string) => {
    const newPosts = posts.map(p => {
      if (p.id === postId) {
        const newComments = p.comments.map(c => {
          if (c.id === commentId) {
            const isLiked = c.likes.includes(currentUser.id);
            const newLikes = isLiked
              ? c.likes.filter(id => id !== currentUser.id)
              : [...c.likes, currentUser.id];
            
            if (!isLiked && c.authorId !== currentUser.id) {
                addNotification(c.authorId, 'like_comment', currentUser.id, postId, commentId);
            }

            return { ...c, likes: newLikes };
          }
          return c;
        });
        return { ...p, comments: newComments };
      }
      return p;
    });
    updatePosts(newPosts);
  };

  const updatePosts = (newPosts: ForumPost[]) => {
    onUpdateAppData({
      ...appData,
      forumData: {
        posts: newPosts,
        notifications: appData.forumData?.notifications || []
      }
    });
  };

  const addNotification = (userId: string, type: ForumNotification['type'], sourceUserId: string, postId: string, commentId?: string) => {
    const newNotification: ForumNotification = {
      id: `n-${Date.now()}`,
      userId,
      type,
      sourceUserId,
      postId,
      commentId,
      timestamp: Date.now(),
      read: false
    };
    const currentNotifications = appData.forumData?.notifications || [];
    onUpdateAppData({
      ...appData,
      forumData: {
        posts: posts,
        notifications: [newNotification, ...currentNotifications]
      }
    });
  };

  const markNotificationsRead = () => {
    const newNotifications = notifications.map(n => 
      n.userId === currentUser.id ? { ...n, read: true } : n
    );
    onUpdateAppData({
      ...appData,
      forumData: {
        posts,
        notifications: newNotifications
      }
    });
  };

  // Mark notifications as read when switching to notification tab
  useEffect(() => {
    if (activeTab === 'notification') {
      markNotificationsRead();
    }
  }, [activeTab]);

  const handleUpdateProfile = () => {
    onUpdateAppData({
      ...appData,
      userProfile: {
        ...currentUser,
        name: editName,
        bio: editBio,
        avatar: editAvatar
      }
    });
    setCurrentView('list');
    setActiveTab('profile');
  };

  // --- Render Components ---

  const renderShareModal = () => {
    if (!showShareModal) return null;
    return (
      <>
        <div className="absolute inset-0 bg-black/50 z-50" onClick={() => setShowShareModal(null)} />
        <div className="absolute bottom-0 left-0 right-0 bg-white rounded-t-2xl z-50 p-4 animate-in slide-in-from-bottom duration-200">
          <div className="flex justify-between items-center mb-4">
            <h3 className="font-bold text-zinc-900">分享至</h3>
            <button onClick={() => setShowShareModal(null)} className="p-1 bg-zinc-100 rounded-full">
              <X size={20} className="text-zinc-500" />
            </button>
          </div>
          <div className="grid grid-cols-4 gap-4 mb-6">
            <button 
              onClick={() => handleRepost(showShareModal)}
              className="flex flex-col items-center gap-2"
            >
              <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center text-green-600">
                <Repeat size={24} />
              </div>
              <span className="text-xs text-zinc-600">转发动态</span>
            </button>
            {appData.characters.map(char => (
              <button 
                key={char.id}
                onClick={() => handleShareToChat(showShareModal, char.id)}
                className="flex flex-col items-center gap-2"
              >
                <img src={char.avatar} className="w-12 h-12 rounded-full object-cover border border-zinc-100" />
                <span className="text-xs text-zinc-600 truncate w-full text-center">{char.name}</span>
              </button>
            ))}
          </div>
        </div>
      </>
    );
  };

  const renderPostList = () => {
    let displayPosts = [...posts];
    
    if (activeTab === 'search') {
      displayPosts = displayPosts.filter(p => 
        p.title.toLowerCase().includes(searchQuery.toLowerCase()) || 
        p.content.toLowerCase().includes(searchQuery.toLowerCase()) ||
        getAuthor(p.authorId).name.toLowerCase().includes(searchQuery.toLowerCase())
      );
    } else {
      if (homeFilter === 'hot') {
        displayPosts.sort((a, b) => (b.comments.length + b.likes.length) - (a.comments.length + a.likes.length));
      } else {
        displayPosts.sort((a, b) => b.timestamp - a.timestamp);
      }
    }

    return (
      <div className="pb-20 bg-white">
        {displayPosts.map(post => {
          const author = getAuthor(post.authorId);
          const handle = `@${author.id.replace('user_', 'u').replace('char_', 'c')}`;
          const isOwner = post.authorId === currentUser.id;
          
          // Format time like Twitter (e.g., "2h", "Oct 24")
          const postDate = new Date(post.timestamp);
          const now = new Date();
          const diffMs = now.getTime() - postDate.getTime();
          const diffMins = Math.floor(diffMs / 60000);
          const diffHours = Math.floor(diffMins / 60);
          const diffDays = Math.floor(diffHours / 24);
          let timeStr = '';
          if (diffMins < 1) timeStr = '刚刚';
          else if (diffMins < 60) timeStr = `${diffMins}分钟`;
          else if (diffHours < 24) timeStr = `${diffHours}小时`;
          else if (diffDays < 365) timeStr = postDate.toLocaleDateString('zh-CN', { month: 'short', day: 'numeric' });
          else timeStr = postDate.toLocaleDateString('zh-CN', { year: 'numeric', month: 'short', day: 'numeric' });

          return (
            <div 
              key={post.id}
              onClick={() => {
                setSelectedPostId(post.id);
                setCurrentView('detail');
                const newPosts = posts.map(p => p.id === post.id ? { ...p, viewCount: p.viewCount + 1 } : p);
                updatePosts(newPosts);
              }}
              className="bg-white p-4 border-b border-zinc-100 hover:bg-zinc-50 transition-colors cursor-pointer flex gap-3"
            >
              <img 
                src={author.avatar} 
                className="w-10 h-10 rounded-full object-cover shrink-0 cursor-pointer" 
                onClick={(e) => {
                  e.stopPropagation();
                  if (author.id !== currentUser.id) {
                    setViewingUserId(author.id);
                    setCurrentView('user-profile');
                  } else {
                    setActiveTab('profile');
                  }
                }}
              />
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1 text-[14px] truncate">
                    <span className="font-bold text-zinc-900 truncate hover:underline">{author.name}</span>
                    {author.id !== 'user_8888' && <CheckCircle2 size={14} className="text-zinc-900 fill-zinc-900 shrink-0" />}
                    <span className="text-zinc-500 truncate">{handle}</span>
                    <span className="text-zinc-500">·</span>
                    <span className="text-zinc-500 hover:underline">{timeStr}</span>
                  </div>
                  <div className="relative">
                    <button 
                      onClick={(e) => {
                        e.stopPropagation();
                        setShowPostMenu(showPostMenu === post.id ? null : post.id);
                      }}
                      className="text-zinc-400 hover:text-zinc-900 hover:bg-zinc-100 p-1.5 rounded-full transition-colors -mr-1.5"
                    >
                      <MoreHorizontal size={18} />
                    </button>
                    {showPostMenu === post.id && (
                      <>
                        <div className="fixed inset-0 z-40" onClick={(e) => { e.stopPropagation(); setShowPostMenu(null); }} />
                        <div className="absolute right-0 top-full mt-1 w-36 bg-white rounded-xl shadow-lg border border-zinc-100 py-1 z-50 overflow-hidden">
                          <button 
                            onClick={(e) => {
                              e.stopPropagation();
                              handleCollectPost(post.id);
                              setShowPostMenu(null);
                            }}
                            className="w-full px-4 py-2 text-left text-[14px] hover:bg-zinc-50 flex items-center gap-2"
                          >
                            <Bookmark size={16} />
                            {post.collections.includes(currentUser.id) ? '取消收藏' : '收藏'}
                          </button>
                          <button 
                            onClick={(e) => {
                              e.stopPropagation();
                              navigator.clipboard.writeText(window.location.href);
                              alert('链接已复制');
                              setShowPostMenu(null);
                            }}
                            className="w-full px-4 py-2 text-left text-[14px] hover:bg-zinc-50 flex items-center gap-2"
                          >
                            <Link2 size={16} />
                            复制链接
                          </button>
                          {isOwner ? (
                            <button 
                              onClick={(e) => {
                                e.stopPropagation();
                                handleDeletePost(post.id);
                                setShowPostMenu(null);
                              }}
                              className="w-full px-4 py-2 text-left text-[14px] text-red-500 hover:bg-red-50 flex items-center gap-2"
                            >
                              <Trash2 size={16} />
                              删除
                            </button>
                          ) : (
                            <button 
                              onClick={(e) => {
                                e.stopPropagation();
                                handleReport();
                                setShowPostMenu(null);
                              }}
                              className="w-full px-4 py-2 text-left text-[14px] text-red-500 hover:bg-red-50 flex items-center gap-2"
                            >
                              <AlertTriangle size={16} />
                              举报
                            </button>
                          )}
                        </div>
                      </>
                    )}
                  </div>
                </div>
                
                {post.title && <h3 className="text-[14px] font-bold text-zinc-900 mt-0.5">{post.title}</h3>}
                <p className="text-[14px] text-zinc-900 mt-0.5 whitespace-pre-wrap leading-snug">{post.content}</p>
                
                {post.images && post.images.length > 0 && (
                  <div className={`mt-3 grid gap-0.5 overflow-hidden rounded-2xl border border-zinc-100 ${post.images.length === 1 ? 'grid-cols-1' : post.images.length === 2 ? 'grid-cols-2' : post.images.length === 3 ? 'grid-cols-2' : 'grid-cols-2'}`}>
                    {post.images.map((img, i) => (
                      <img key={i} src={img} className={`w-full object-cover ${post.images!.length === 1 ? 'max-h-80' : 'h-32'} ${post.images!.length === 3 && i === 0 ? 'row-span-2 h-full' : ''}`} />
                    ))}
                  </div>
                )}
                
                <div className="flex items-center justify-between mt-3 text-zinc-500 max-w-md pr-4">
                  <button className="flex items-center gap-1 hover:text-zinc-900 group transition-colors">
                    <div className="p-1.5 rounded-full group-hover:bg-zinc-100 transition-colors -ml-1.5">
                      <MessageCircle size={18} />
                    </div>
                    <span className="text-[12px]">{post.comments.length > 0 ? post.comments.length : ''}</span>
                  </button>
                  <button className="flex items-center gap-1 hover:text-green-500 group transition-colors">
                    <div className="p-1.5 rounded-full group-hover:bg-green-50 transition-colors -ml-1.5">
                      <Repeat size={18} />
                    </div>
                    <span className="text-[12px]">{post.collections.length > 0 ? post.collections.length : ''}</span>
                  </button>
                  <button 
                    onClick={(e) => { e.stopPropagation(); handleLikePost(post.id); }}
                    className={`flex items-center gap-1 group transition-colors ${post.likes.includes(currentUser.id) ? 'text-pink-500' : 'hover:text-pink-500'}`}
                  >
                    <div className="p-1.5 rounded-full group-hover:bg-pink-50 transition-colors -ml-1.5">
                      <Heart size={18} className={post.likes.includes(currentUser.id) ? 'fill-pink-500' : ''} />
                    </div>
                    <span className="text-[12px]">{post.likes.length > 0 ? post.likes.length : ''}</span>
                  </button>
                  <button className="flex items-center gap-1 hover:text-zinc-900 group transition-colors">
                    <div className="p-1.5 rounded-full group-hover:bg-zinc-100 transition-colors -ml-1.5">
                      <BarChart2 size={18} />
                    </div>
                    <span className="text-[12px]">{post.viewCount > 0 ? post.viewCount : ''}</span>
                  </button>
                  <div className="flex items-center gap-2">
                    <button 
                      onClick={(e) => { 
                        e.stopPropagation(); 
                        setShowShareModal(post.id);
                      }}
                      className="flex items-center gap-1 hover:text-zinc-900 group transition-colors"
                    >
                      <div className="p-1.5 rounded-full group-hover:bg-zinc-100 transition-colors -ml-1.5">
                        <Share2 size={18} />
                      </div>
                    </button>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
        {displayPosts.length === 0 && (
          <div className="text-center py-10 text-zinc-400 text-[14px]">这里空空如也</div>
        )}
      </div>
    );
  };

  const renderPostDetail = () => {
    const post = posts.find(p => p.id === selectedPostId);
    if (!post) return null;
    const author = getAuthor(post.authorId);
    const handle = `@${author.id.replace('user_', 'u').replace('char_', 'c')}`;
    const isOwner = post.authorId === currentUser.id;

    const postDate = new Date(post.timestamp);
    const timeStr = postDate.toLocaleTimeString('zh-CN', { hour: 'numeric', minute: '2-digit', hour12: false });
    const dateStr = postDate.toLocaleDateString('zh-CN', { year: 'numeric', month: 'long', day: 'numeric' });

    return (
      <div className="bg-white h-full flex flex-col relative">
        {/* Header */}
        <div className="sticky top-0 bg-white/90 backdrop-blur-md z-10 px-4 py-2 flex items-center gap-6">
          <button onClick={() => setCurrentView('list')} className="p-2 -ml-2 text-zinc-900 hover:bg-zinc-100 rounded-full transition-colors">
            <ArrowLeft size={20} />
          </button>
          <h2 className="font-bold text-lg text-zinc-900">帖子</h2>
        </div>

        {/* Content */}
        <div className="px-4 pt-2 flex-1 overflow-y-auto pb-24">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-3">
              <img 
                src={author.avatar} 
                className="w-9 h-9 rounded-full object-cover cursor-pointer" 
                onClick={(e) => {
                  e.stopPropagation();
                  if (author.id !== currentUser.id) {
                    setViewingUserId(author.id);
                    setCurrentView('user-profile');
                  } else {
                    setActiveTab('profile');
                  }
                }}
              />
              <div className="flex flex-col">
                <div className="flex items-center gap-1">
                  <span className="font-bold text-[14px] text-zinc-900 hover:underline">{author.name}</span>
                  {author.id !== 'user_8888' && <CheckCircle2 size={14} className="text-zinc-900 fill-zinc-900" />}
                </div>
                <span className="text-[13px] text-zinc-500">{handle}</span>
              </div>
            </div>
            <div className="relative">
              <button 
                onClick={() => setShowPostMenu(showPostMenu === post.id ? null : post.id)}
                className="p-1.5 text-zinc-500 hover:bg-zinc-100 rounded-full transition-colors"
              >
                <MoreHorizontal size={18} />
              </button>
              {showPostMenu === post.id && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setShowPostMenu(null)} />
                  <div className="absolute right-0 top-full mt-1 w-32 bg-white rounded-xl shadow-lg border border-zinc-100 py-1 z-50 overflow-hidden">
                    <button 
                      onClick={() => {
                        handleCollectPost(post.id);
                        setShowPostMenu(null);
                      }}
                      className="w-full px-3 py-2 text-left text-[13px] hover:bg-zinc-50 flex items-center gap-2"
                    >
                      <Bookmark size={14} />
                      {post.collections.includes(currentUser.id) ? '取消收藏' : '收藏'}
                    </button>
                    <button 
                      onClick={() => {
                        navigator.clipboard.writeText(window.location.href);
                        alert('链接已复制');
                        setShowPostMenu(null);
                      }}
                      className="w-full px-3 py-2 text-left text-[13px] hover:bg-zinc-50 flex items-center gap-2"
                    >
                      <Link2 size={14} />
                      复制链接
                    </button>
                    {isOwner ? (
                      <button 
                        onClick={() => {
                          handleDeletePost(post.id);
                          setShowPostMenu(null);
                        }}
                        className="w-full px-3 py-2 text-left text-[13px] text-red-500 hover:bg-red-50 flex items-center gap-2"
                      >
                        <Trash2 size={14} />
                        删除
                      </button>
                    ) : (
                      <button 
                        onClick={() => {
                          handleReport();
                          setShowPostMenu(null);
                        }}
                        className="w-full px-3 py-2 text-left text-[13px] text-red-500 hover:bg-red-50 flex items-center gap-2"
                      >
                        <AlertTriangle size={14} />
                        举报
                      </button>
                    )}
                  </div>
                </>
              )}
            </div>
          </div>

          {post.title && <h1 className="text-base font-bold text-zinc-900 mb-2">{post.title}</h1>}
          <p className="text-[15px] text-zinc-900 leading-normal whitespace-pre-wrap mb-2">{post.content}</p>
          
          {post.images && post.images.length > 0 && (
            <div className={`mb-2 grid gap-0.5 overflow-hidden rounded-2xl border border-zinc-100 ${post.images.length === 1 ? 'grid-cols-1' : post.images.length === 2 ? 'grid-cols-2' : post.images.length === 3 ? 'grid-cols-2' : 'grid-cols-2'}`}>
              {post.images.map((img, i) => (
                <img key={i} src={img} className={`w-full object-cover ${post.images!.length === 1 ? 'max-h-80' : 'h-32'} ${post.images!.length === 3 && i === 0 ? 'row-span-2 h-full' : ''}`} />
              ))}
            </div>
          )}

          <div className="flex items-center gap-1 text-[13px] text-zinc-500 py-2 border-b border-zinc-100">
            <span>{timeStr}</span>
            <span>·</span>
            <span>{dateStr}</span>
            <span>·</span>
            <span className="font-bold text-zinc-900">{post.viewCount}</span>
            <span>查看</span>
          </div>

          <div className="flex items-center gap-6 py-2 border-b border-zinc-100 text-[13px]">
            <div className="flex items-center gap-1">
              <span className="font-bold text-zinc-900">{post.comments.length}</span>
              <span className="text-zinc-500">回复</span>
            </div>
            <div className="flex items-center gap-1">
              <span className="font-bold text-zinc-900">{post.collections.length}</span>
              <span className="text-zinc-500">转发</span>
            </div>
            <div className="flex items-center gap-1">
              <span className="font-bold text-zinc-900">{post.likes.length}</span>
              <span className="text-zinc-500">喜欢</span>
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center justify-around py-1 border-b border-zinc-100 text-zinc-500">
            <button className="p-1.5 hover:text-zinc-900 hover:bg-zinc-100 rounded-full transition-colors">
              <MessageCircle size={20} />
            </button>
            <button className="p-1.5 hover:text-green-500 hover:bg-green-50 rounded-full transition-colors">
              <Repeat size={20} />
            </button>
            <button 
              onClick={() => handleLikePost(post.id)}
              className={`p-1.5 rounded-full transition-colors ${post.likes.includes(currentUser.id) ? 'text-pink-500' : 'hover:text-pink-500 hover:bg-pink-50'}`}
            >
              <Heart size={20} className={post.likes.includes(currentUser.id) ? 'fill-pink-500' : ''} />
            </button>
            <button 
              onClick={() => setShowShareModal(post.id)}
              className="p-1.5 hover:text-zinc-900 hover:bg-zinc-100 rounded-full transition-colors"
            >
              <Share2 size={20} />
            </button>
          </div>

          {/* Comments */}
          <div className="mt-0">
            {post.comments.filter(c => !c.replyToId).map(comment => (
              <ForumCommentItem 
                key={comment.id} 
                comment={comment} 
                post={post} 
                currentUser={currentUser}
                followedUsers={followedUsers}
                getAuthor={getAuthor}
                onReply={handleComment}
                onLike={handleLikeComment}
                onDelete={handleDeleteComment}
                onReport={handleReport}
                onUserClick={handleUserClick}
                onFollow={handleFollow}
              />
            ))}
          </div>
        </div>

        {/* Reply Input */}
        <div className="sticky bottom-0 bg-white border-t border-zinc-100 px-3 py-2 flex items-center gap-3">
          <img src={currentUser.avatar} className="w-7 h-7 rounded-full object-cover" />
          <input 
            type="text" 
            value={mainReplyText}
            onChange={(e) => setMainReplyText(e.target.value)}
            placeholder="发布你的回复"
            className="flex-1 bg-transparent text-[14px] outline-none placeholder-zinc-500"
            onKeyDown={(e) => {
              if (e.key === 'Enter' && mainReplyText.trim()) {
                handleComment(post.id, mainReplyText.trim());
                setMainReplyText('');
              }
            }}
          />
          <button 
            onClick={() => {
              if (mainReplyText.trim()) {
                handleComment(post.id, mainReplyText.trim());
                setMainReplyText('');
              }
            }}
            disabled={!mainReplyText.trim()}
            className={`px-3 py-1.5 rounded-full font-bold text-[12px] transition-all shrink-0 whitespace-nowrap ${mainReplyText.trim() ? 'bg-zinc-900 text-white' : 'bg-zinc-200 text-zinc-400 cursor-not-allowed'}`}
          >
            回复
          </button>
        </div>
        {/* Share Modal */}
        {renderShareModal()}
      </div>
    );
  };

  const renderEditor = () => (
    <div className="bg-white min-h-full flex flex-col">
      <div className="px-4 py-3 flex items-center justify-between sticky top-0 bg-white/90 backdrop-blur-md z-10">
        <button onClick={() => {
          setCurrentView('list');
          setEditingPostId(null);
        }} className="text-zinc-900 font-bold text-[14px]">取消</button>
        <div className="flex gap-4 items-center">
          <button className="text-zinc-900 font-bold text-[14px]">草稿</button>
          <button 
            onClick={handlePublish}
            className={`bg-zinc-900 text-white px-4 py-1.5 rounded-full text-[14px] font-bold ${(!editorTitle.trim() || !editorContent.trim()) ? 'opacity-50' : ''}`}
          >
            发布
          </button>
        </div>
      </div>
      <div className="p-4 flex-1 flex gap-3">
        <img src={currentUser.avatar} className="w-10 h-10 rounded-full object-cover shrink-0" />
        <div className="flex-1">
          <input
            type="text"
            placeholder="标题（可选）"
            value={editorTitle}
            onChange={e => setEditorTitle(e.target.value)}
            className="w-full text-base font-bold outline-none placeholder-zinc-500 mb-2 bg-transparent"
          />
          <textarea
            placeholder="有什么新鲜事？！"
            value={editorContent}
            onChange={e => setEditorContent(e.target.value)}
            className="w-full h-32 text-lg outline-none resize-none placeholder-zinc-500 bg-transparent"
          />
          
          {editorImages.length > 0 && (
            <div className={`grid gap-0.5 mt-4 overflow-hidden rounded-2xl border border-zinc-100 ${editorImages.length === 1 ? 'grid-cols-1' : editorImages.length === 2 ? 'grid-cols-2' : editorImages.length === 3 ? 'grid-cols-2' : 'grid-cols-2'}`}>
              {editorImages.map((img, i) => (
                <div key={i} className={`relative ${editorImages.length === 1 ? 'max-h-80' : 'h-32'} ${editorImages.length === 3 && i === 0 ? 'row-span-2 h-full' : ''}`}>
                  <img src={img} className="w-full h-full object-cover" />
                  <button 
                    onClick={() => setEditorImages(editorImages.filter((_, idx) => idx !== i))}
                    className="absolute top-2 right-2 bg-black/50 hover:bg-black/70 text-white rounded-full p-1.5 transition-colors backdrop-blur-sm"
                  >
                    <X size={16} />
                  </button>
                </div>
              ))}
            </div>
          )}
          
          <div className="flex items-center gap-4 mt-4 pt-4 border-t border-zinc-100 text-zinc-900">
            <label className="p-2 hover:bg-zinc-100 rounded-full transition-colors -ml-2 cursor-pointer">
              <ImageIcon size={20} />
              <input 
                type="file" 
                multiple 
                accept="image/*" 
                className="hidden" 
                onChange={(e) => {
                  const files = Array.from(e.target.files || []) as File[];
                  files.forEach(file => {
                    const reader = new FileReader();
                    reader.onload = () => {
                      setEditorImages(prev => [...prev, reader.result as string].slice(0, 9));
                    };
                    reader.readAsDataURL(file);
                  });
                }} 
              />
            </label>
            <button 
              onClick={() => setShowUrlInput(!showUrlInput)}
              className="p-2 hover:bg-zinc-100 rounded-full transition-colors"
            >
              <Link2 size={20} />
            </button>
            <button className="p-2 hover:bg-zinc-100 rounded-full transition-colors">
              <Camera size={20} />
            </button>
          </div>

          {showUrlInput && (
            <div className="mt-4 p-3 bg-zinc-50 rounded-xl border border-zinc-100">
              <div className="flex justify-between items-center mb-2">
                <span className="text-xs font-bold text-zinc-500">添加图片链接</span>
                <button onClick={() => setShowUrlInput(false)} className="text-zinc-400 hover:text-zinc-600">
                  <X size={14} />
                </button>
              </div>
              <textarea
                value={urlInput}
                onChange={e => setUrlInput(e.target.value)}
                placeholder="支持输入图片链接、Markdown图片格式、HTML img标签"
                className="w-full h-24 bg-white border border-zinc-200 rounded-lg p-2 text-xs outline-none focus:border-zinc-900/30 transition-all resize-none"
              />
              <button 
                onClick={() => {
                  const urls = extractImageUrls(urlInput);
                  if (urls.length > 0) {
                    setEditorImages(prev => [...prev, ...urls].slice(0, 9));
                    setUrlInput('');
                    setShowUrlInput(false);
                  }
                }}
                className="w-full mt-2 bg-zinc-900 text-white py-1.5 rounded-lg text-xs font-bold"
              >
                添加这些链接
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );

  const renderHotList = () => {
    // Sort posts by view count + comments + likes for "hotness"
    const hotPosts = [...posts].sort((a, b) => {
      const scoreA = a.viewCount + a.comments.length * 10 + a.likes.length * 5;
      const scoreB = b.viewCount + b.comments.length * 10 + b.likes.length * 5;
      return scoreB - scoreA;
    });

    return (
      <div className="bg-white min-h-full pb-20">
        <div className="px-4 py-3 border-b border-zinc-100">
          <h2 className="text-lg font-bold text-zinc-900">为你推荐的趋势</h2>
        </div>
        <div className="space-y-0">
          {hotPosts.map((post, index) => {
            const author = getAuthor(post.authorId);
            return (
              <div 
                key={post.id}
                onClick={() => {
                  setSelectedPostId(post.id);
                  setCurrentView('detail');
                  const newPosts = posts.map(p => p.id === post.id ? { ...p, viewCount: p.viewCount + 1 } : p);
                  updatePosts(newPosts);
                }}
                className="px-4 py-3 hover:bg-zinc-50 transition-colors cursor-pointer flex justify-between items-start"
              >
                <div className="flex-1 min-w-0 pr-4">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-[12px] text-zinc-500 font-bold">{index + 1} · 趋势</span>
                    <div className="relative">
                      <button 
                        onClick={(e) => {
                          e.stopPropagation();
                          setShowPostMenu(showPostMenu === post.id ? null : post.id);
                        }}
                        className="text-zinc-400 hover:text-zinc-900 hover:bg-zinc-100 p-1.5 rounded-full transition-colors -mr-1.5"
                      >
                        <MoreHorizontal size={18} />
                      </button>
                      {showPostMenu === post.id && (
                        <>
                          <div className="fixed inset-0 z-40" onClick={(e) => { e.stopPropagation(); setShowPostMenu(null); }} />
                          <div className="absolute right-0 top-full mt-1 w-36 bg-white rounded-xl shadow-lg border border-zinc-100 py-1 z-50 overflow-hidden">
                            <button 
                              onClick={(e) => {
                                e.stopPropagation();
                                handleCollectPost(post.id);
                                setShowPostMenu(null);
                              }}
                              className="w-full px-4 py-2 text-left text-[14px] hover:bg-zinc-50 flex items-center gap-2"
                            >
                              <Bookmark size={16} />
                              {post.collections.includes(currentUser.id) ? '取消收藏' : '收藏'}
                            </button>
                            <button 
                              onClick={(e) => {
                                e.stopPropagation();
                                navigator.clipboard.writeText(window.location.href);
                                alert('链接已复制');
                                setShowPostMenu(null);
                              }}
                              className="w-full px-4 py-2 text-left text-[14px] hover:bg-zinc-50 flex items-center gap-2"
                            >
                              <Link2 size={16} />
                              复制链接
                            </button>
                            {post.authorId === currentUser.id ? (
                              <button 
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleDeletePost(post.id);
                                  setShowPostMenu(null);
                                }}
                                className="w-full px-4 py-2 text-left text-[14px] text-red-500 hover:bg-red-50 flex items-center gap-2"
                              >
                                <Trash2 size={16} />
                                删除
                              </button>
                            ) : (
                              <button 
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleReport();
                                  setShowPostMenu(null);
                                }}
                                className="w-full px-4 py-2 text-left text-[14px] text-red-500 hover:bg-red-50 flex items-center gap-2"
                              >
                                <AlertTriangle size={16} />
                                举报
                              </button>
                            )}
                          </div>
                        </>
                      )}
                    </div>
                  </div>
                  <h3 className="text-[14px] font-bold text-zinc-900 mb-1 line-clamp-2">{post.title || post.content}</h3>
                  <div className="text-[12px] text-zinc-500">
                    {post.viewCount > 1000 ? `${(post.viewCount / 1000).toFixed(1)}K` : post.viewCount} 帖子
                  </div>
                </div>
                {post.images && post.images.length > 0 && (
                  <img src={post.images[0]} className="w-16 h-16 rounded-xl object-cover shrink-0" />
                )}
              </div>
            );
          })}
        </div>
        {/* Share Modal */}
        {renderShareModal()}
      </div>
    );
  };

  const renderUserProfile = () => {
    if (!viewingUserId) return null;
    const user = getAuthor(viewingUserId);
    const userPosts = posts.filter(p => p.authorId === viewingUserId).sort((a, b) => b.timestamp - a.timestamp);
    const handle = `@u${user.id.replace(/\D/g, '').slice(-4) || '0000'}`;
    const isFollowed = followedUsers.includes(user.id);

    return (
      <div className="bg-white min-h-full pb-20">
        {/* Header */}
        <div className="sticky top-0 bg-white/90 backdrop-blur-md z-10 px-4 py-3 flex items-center gap-6">
          <button onClick={() => {
            setCurrentView('list');
            setViewingUserId(null);
          }} className="p-2 -ml-2 text-zinc-900 hover:bg-zinc-100 rounded-full transition-colors">
            <ArrowLeft size={20} />
          </button>
          <div className="flex flex-col">
            <h2 className="font-bold text-lg text-zinc-900 leading-tight">{user.name}</h2>
            <span className="text-[12px] text-zinc-500">{userPosts.length} 帖子</span>
          </div>
        </div>

        {/* Profile Header */}
        <div className="px-4 pt-12 pb-6">
          <div className="flex gap-6">
            {/* Left: Avatar, Name, ID */}
            <div className="flex flex-col items-center shrink-0 w-24">
              <img src={user.avatar} className="w-24 h-24 rounded-full border-2 border-zinc-100 object-cover shadow-sm mb-3" />
              <h2 className="text-[15px] font-bold text-zinc-900 text-center leading-tight">{user.name}</h2>
              <p className="text-[12px] text-zinc-500 text-center mt-1">{handle}</p>
            </div>

            {/* Right: Bio, Stats, Actions */}
            <div className="flex-1 flex flex-col">
              <div className="flex justify-end gap-2 mb-4">
                {onOpenChat && !user.id.startsWith('user_') && (
                  <button 
                    onClick={() => onOpenChat(user.id)}
                    className="w-9 h-9 rounded-full border border-zinc-200 flex items-center justify-center text-zinc-900 hover:bg-zinc-50 transition-colors"
                  >
                    <MessageCircle size={18} />
                  </button>
                )}
                <button 
                  onClick={() => {
                    const newFollowed = isFollowed 
                      ? followedUsers.filter(id => id !== user.id)
                      : [...followedUsers, user.id];
                    onUpdateAppData({
                      ...appData,
                      forumData: {
                        ...appData.forumData!,
                        followedUsers: newFollowed
                      }
                    });
                  }}
                  className={`px-5 py-1.5 rounded-full font-bold text-[13px] transition-colors ${
                    isFollowed 
                      ? 'border border-zinc-200 text-zinc-900 hover:bg-zinc-50' 
                      : 'bg-zinc-900 text-white hover:bg-zinc-800'
                  }`}
                >
                  {isFollowed ? '已关注' : '关注'}
                </button>
              </div>

              <div className="p-2 flex-1">
                <p className="text-[13px] text-zinc-600 leading-relaxed mb-4 italic">
                  {('bio' in user ? user.bio : 'description' in user ? user.description : '') || '暂无简介。'}
                </p>
                <div className="flex gap-6 border-t border-zinc-100 pt-3">
                  <div className="flex flex-col">
                    <span className="font-bold text-zinc-900 text-[14px]">124</span>
                    <span className="text-zinc-400 text-[11px] uppercase tracking-wider text-center">正在关注</span>
                  </div>
                  <div className="flex flex-col">
                    <span className="font-bold text-zinc-900 text-[14px]">{isFollowed ? '1,025' : '1,024'}</span>
                    <span className="text-zinc-400 text-[11px] uppercase tracking-wider text-center">关注者</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Profile Tabs */}
        <div className="flex border-b border-zinc-100">
          <button className="flex-1 py-4 text-[14px] font-bold text-zinc-900 relative hover:bg-zinc-50 transition-colors">
            帖子
            <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-12 h-1 bg-zinc-900 rounded-full" />
          </button>
          <button className="flex-1 py-4 text-[14px] font-bold text-zinc-500 relative hover:bg-zinc-50 transition-colors">
            回复
          </button>
          <button className="flex-1 py-4 text-[14px] font-bold text-zinc-500 relative hover:bg-zinc-50 transition-colors">
            喜欢
          </button>
        </div>

        <div className="space-y-0">
          {/* User Posts Section */}
          {userPosts.length > 0 ? userPosts.map(post => {
            const postDate = new Date(post.timestamp);
            const now = new Date();
            const diffMs = now.getTime() - postDate.getTime();
            const diffMins = Math.floor(diffMs / 60000);
            const diffHours = Math.floor(diffMins / 60);
            const diffDays = Math.floor(diffHours / 24);
            let timeStr = '';
            if (diffMins < 1) timeStr = '刚刚';
            else if (diffMins < 60) timeStr = `${diffMins}分钟`;
            else if (diffHours < 24) timeStr = `${diffHours}小时`;
            else if (diffDays < 365) timeStr = postDate.toLocaleDateString('zh-CN', { month: 'short', day: 'numeric' });
            else timeStr = postDate.toLocaleDateString('zh-CN', { year: 'numeric', month: 'short', day: 'numeric' });

            return (
              <div 
                key={post.id}
                onClick={() => {
                  setSelectedPostId(post.id);
                  setCurrentView('detail');
                }}
                className="bg-white p-4 border-b border-zinc-100 hover:bg-zinc-50 transition-colors cursor-pointer flex gap-3"
              >
                <img src={user.avatar} className="w-10 h-10 rounded-full object-cover shrink-0" />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1 text-[14px] truncate">
                      <span className="font-bold text-zinc-900 truncate hover:underline">{user.name}</span>
                      <span className="text-zinc-500 truncate">{handle}</span>
                      <span className="text-zinc-500">·</span>
                      <span className="text-zinc-500 hover:underline">{timeStr}</span>
                    </div>
                    <div className="relative">
                      <button 
                        onClick={(e) => {
                          e.stopPropagation();
                          setShowPostMenu(showPostMenu === post.id ? null : post.id);
                        }}
                        className="text-zinc-400 hover:text-zinc-900 hover:bg-zinc-100 p-1.5 rounded-full transition-colors -mr-1.5"
                      >
                        <MoreHorizontal size={18} />
                      </button>
                      {showPostMenu === post.id && (
                        <>
                          <div className="fixed inset-0 z-40" onClick={(e) => { e.stopPropagation(); setShowPostMenu(null); }} />
                          <div className="absolute right-0 top-full mt-1 w-36 bg-white rounded-xl shadow-lg border border-zinc-100 py-1 z-50 overflow-hidden">
                            <button 
                              onClick={(e) => {
                                e.stopPropagation();
                                handleCollectPost(post.id);
                                setShowPostMenu(null);
                              }}
                              className="w-full px-4 py-2 text-left text-[14px] hover:bg-zinc-50 flex items-center gap-2"
                            >
                              <Bookmark size={16} />
                              {post.collections.includes(currentUser.id) ? '取消收藏' : '收藏'}
                            </button>
                            <button 
                              onClick={(e) => {
                                e.stopPropagation();
                                navigator.clipboard.writeText(window.location.href);
                                alert('链接已复制');
                                setShowPostMenu(null);
                              }}
                              className="w-full px-4 py-2 text-left text-[14px] hover:bg-zinc-50 flex items-center gap-2"
                            >
                              <Link2 size={16} />
                              复制链接
                            </button>
                            {post.authorId === currentUser.id ? (
                              <button 
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleDeletePost(post.id);
                                  setShowPostMenu(null);
                                }}
                                className="w-full px-4 py-2 text-left text-[14px] text-red-500 hover:bg-red-50 flex items-center gap-2"
                              >
                                <Trash2 size={16} />
                                删除
                              </button>
                            ) : (
                              <button 
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleReport();
                                  setShowPostMenu(null);
                                }}
                                className="w-full px-4 py-2 text-left text-[14px] text-red-500 hover:bg-red-50 flex items-center gap-2"
                              >
                                <AlertTriangle size={16} />
                                举报
                              </button>
                            )}
                          </div>
                        </>
                      )}
                    </div>
                  </div>
                  
                  {post.title && <h3 className="text-[14px] font-bold text-zinc-900 mt-0.5">{post.title}</h3>}
                  <p className="text-[14px] text-zinc-900 mt-0.5 whitespace-pre-wrap leading-snug">{post.content}</p>
                  
                  <div className="flex items-center justify-between mt-3 text-zinc-500 max-w-md pr-4">
                    <button className="flex items-center gap-1 hover:text-zinc-900 group transition-colors">
                      <div className="p-1.5 rounded-full group-hover:bg-zinc-100 transition-colors -ml-1.5">
                        <MessageCircle size={18} />
                      </div>
                      <span className="text-[12px]">{post.comments.length > 0 ? post.comments.length : ''}</span>
                    </button>
                    <button className="flex items-center gap-1 hover:text-green-500 group transition-colors">
                      <div className="p-1.5 rounded-full group-hover:bg-green-50 transition-colors -ml-1.5">
                        <Repeat size={18} />
                      </div>
                      <span className="text-[12px]">{post.collections.length > 0 ? post.collections.length : ''}</span>
                    </button>
                    <button className="flex items-center gap-1 hover:text-pink-500 group transition-colors">
                      <div className="p-1.5 rounded-full group-hover:bg-pink-50 transition-colors -ml-1.5">
                        <Heart size={18} />
                      </div>
                      <span className="text-[12px]">{post.likes.length > 0 ? post.likes.length : ''}</span>
                    </button>
                    <button className="flex items-center gap-1 hover:text-zinc-900 group transition-colors">
                      <div className="p-1.5 rounded-full group-hover:bg-zinc-100 transition-colors -ml-1.5">
                        <BarChart2 size={18} />
                      </div>
                      <span className="text-[12px]">{post.viewCount > 0 ? post.viewCount : ''}</span>
                    </button>
                  </div>
                </div>
              </div>
            );
          }) : (
            <div className="text-center py-10 text-zinc-500 text-[14px]">
              <h3 className="font-bold text-lg text-zinc-900 mb-2">还没有帖子</h3>
              <p>当该用户发布帖子时，它会显示在这里。</p>
            </div>
          )}
        </div>
      </div>
    );
  };

  const renderProfile = () => {
    const myPosts = posts.filter(p => p.authorId === currentUser.id);
    const myReplies = posts.flatMap(p => p.comments).filter(c => c.authorId === currentUser.id);
    const myCollections = posts.filter(p => p.collections.includes(currentUser.id));
    const handle = `@${currentUser.id.replace('user_', 'u').replace('char_', 'c')}`;

    if (currentView === 'edit-profile') {
      return (
        <div className="bg-white min-h-full flex flex-col">
          <div className="px-4 py-3 flex items-center justify-between sticky top-0 bg-white/90 backdrop-blur-md z-10">
            <div className="flex items-center gap-6">
              <button onClick={() => setCurrentView('list')} className="p-2 -ml-2 text-zinc-900 hover:bg-zinc-100 rounded-full transition-colors">
                <ArrowLeft size={20} />
              </button>
              <h2 className="font-bold text-lg text-zinc-900">编辑个人资料</h2>
            </div>
            <button 
              onClick={handleUpdateProfile} 
              className="bg-zinc-900 text-white px-4 py-1.5 rounded-full text-[14px] font-bold"
            >
              保存
            </button>
          </div>
          <div className="p-4 space-y-6">
            <div className="relative mb-6">
              <div className="relative">
                <img src={editAvatar || currentUser.avatar} className="w-20 h-20 rounded-full object-cover border-4 border-white shadow-sm" />
                <button className="absolute bottom-0 left-14 bg-zinc-900/80 p-1.5 rounded-full text-white">
                  <Camera size={16} />
                </button>
              </div>
            </div>
            
            <div className="space-y-4">
              <div className="relative border border-zinc-200 rounded-md px-3 py-2 focus-within:border-zinc-900 focus-within:ring-1 focus-within:ring-zinc-900 transition-all">
                <label className="block text-[12px] text-zinc-500">名称</label>
                <input 
                  value={editName} 
                  onChange={e => setEditName(e.target.value)}
                  className="w-full bg-transparent text-[14px] text-zinc-900 outline-none" 
                />
              </div>
              <div className="relative border border-zinc-200 rounded-md px-3 py-2 focus-within:border-zinc-900 focus-within:ring-1 focus-within:ring-zinc-900 transition-all">
                <label className="block text-[12px] text-zinc-500">简介</label>
                <textarea 
                  value={editBio} 
                  onChange={e => setEditBio(e.target.value)}
                  className="w-full bg-transparent text-[14px] text-zinc-900 outline-none h-20 resize-none" 
                />
              </div>
            </div>
          </div>
        </div>
      );
    }

    return (
      <div className="bg-white min-h-full pb-20">
        {/* Profile Header */}
        <div className="px-4 pt-12 pb-6">
          <div className="flex gap-6">
            {/* Left: Avatar, Name, ID */}
            <div className="flex flex-col items-center shrink-0 w-24">
              <img src={currentUser.avatar} className="w-24 h-24 rounded-full border-2 border-zinc-100 object-cover shadow-sm mb-3" />
              <h2 className="text-[15px] font-bold text-zinc-900 text-center leading-tight">{currentUser.name}</h2>
              <p className="text-[12px] text-zinc-500 text-center mt-1">{handle}</p>
            </div>

            {/* Right: Bio, Stats, Actions */}
            <div className="flex-1 flex flex-col">
              <div className="flex justify-end mb-4">
                <button 
                  onClick={() => {
                    setEditName(currentUser.name);
                    setEditBio(currentUser.bio);
                    setEditAvatar(currentUser.avatar);
                    setCurrentView('edit-profile');
                  }}
                  className="px-5 py-1.5 rounded-full border border-zinc-200 font-bold text-[13px] text-zinc-900 hover:bg-zinc-50 transition-colors"
                >
                  编辑个人资料
                </button>
              </div>

              <div className="p-2 flex-1">
                <p className="text-[13px] text-zinc-600 leading-relaxed mb-4 italic">
                  {currentUser.bio || '暂无简介。'}
                </p>
                <div className="flex gap-6 border-t border-zinc-100 pt-3">
                  <div className="flex flex-col">
                    <span className="font-bold text-zinc-900 text-[14px]">124</span>
                    <span className="text-zinc-400 text-[11px] uppercase tracking-wider text-center">正在关注</span>
                  </div>
                  <div className="flex flex-col">
                    <span className="font-bold text-zinc-900 text-[14px]">1,024</span>
                    <span className="text-zinc-400 text-[11px] uppercase tracking-wider text-center">关注者</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Profile Tabs */}
        <div className="flex border-b border-zinc-100">
          <button className="flex-1 py-4 text-[14px] font-bold text-zinc-900 relative hover:bg-zinc-50 transition-colors">
            帖子
            <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-12 h-1 bg-zinc-900 rounded-full" />
          </button>
          <button className="flex-1 py-4 text-[14px] font-bold text-zinc-500 relative hover:bg-zinc-50 transition-colors">
            回复
          </button>
          <button className="flex-1 py-4 text-[14px] font-bold text-zinc-500 relative hover:bg-zinc-50 transition-colors">
            喜欢
          </button>
        </div>

        <div className="space-y-0">
          {/* My Posts Section */}
          {myPosts.length > 0 ? myPosts.map(post => {
            const postDate = new Date(post.timestamp);
            const now = new Date();
            const diffMs = now.getTime() - postDate.getTime();
            const diffMins = Math.floor(diffMs / 60000);
            const diffHours = Math.floor(diffMins / 60);
            const diffDays = Math.floor(diffHours / 24);
            let timeStr = '';
            if (diffMins < 1) timeStr = '刚刚';
            else if (diffMins < 60) timeStr = `${diffMins}分钟`;
            else if (diffHours < 24) timeStr = `${diffHours}小时`;
            else if (diffDays < 365) timeStr = postDate.toLocaleDateString('zh-CN', { month: 'short', day: 'numeric' });
            else timeStr = postDate.toLocaleDateString('zh-CN', { year: 'numeric', month: 'short', day: 'numeric' });

            return (
              <div 
                key={post.id}
                onClick={() => {
                  setSelectedPostId(post.id);
                  setCurrentView('detail');
                }}
                className="bg-white p-4 border-b border-zinc-100 hover:bg-zinc-50 transition-colors cursor-pointer flex gap-3"
              >
                <img src={currentUser.avatar} className="w-10 h-10 rounded-full object-cover shrink-0" />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1 text-[14px] truncate">
                      <span className="font-bold text-zinc-900 truncate hover:underline">{currentUser.name}</span>
                      <span className="text-zinc-500 truncate">{handle}</span>
                      <span className="text-zinc-500">·</span>
                      <span className="text-zinc-500 hover:underline">{timeStr}</span>
                    </div>
                    <button className="text-zinc-400 hover:text-zinc-900 hover:bg-zinc-100 p-1.5 rounded-full transition-colors -mr-1.5">
                      <MoreHorizontal size={18} />
                    </button>
                  </div>
                  
                  {post.title && <h3 className="text-[14px] font-bold text-zinc-900 mt-0.5">{post.title}</h3>}
                  <p className="text-[14px] text-zinc-900 mt-0.5 whitespace-pre-wrap leading-snug">{post.content}</p>
                  
                  <div className="flex items-center justify-between mt-3 text-zinc-500 max-w-md pr-4">
                    <button className="flex items-center gap-1 hover:text-zinc-900 group transition-colors">
                      <div className="p-1.5 rounded-full group-hover:bg-zinc-100 transition-colors -ml-1.5">
                        <MessageCircle size={18} />
                      </div>
                      <span className="text-[12px]">{post.comments.length > 0 ? post.comments.length : ''}</span>
                    </button>
                    <button className="flex items-center gap-1 hover:text-green-500 group transition-colors">
                      <div className="p-1.5 rounded-full group-hover:bg-green-50 transition-colors -ml-1.5">
                        <Repeat size={18} />
                      </div>
                      <span className="text-[12px]">{post.collections.length > 0 ? post.collections.length : ''}</span>
                    </button>
                    <button className="flex items-center gap-1 hover:text-pink-500 group transition-colors">
                      <div className="p-1.5 rounded-full group-hover:bg-pink-50 transition-colors -ml-1.5">
                        <Heart size={18} />
                      </div>
                      <span className="text-[12px]">{post.likes.length > 0 ? post.likes.length : ''}</span>
                    </button>
                    <button className="flex items-center gap-1 hover:text-zinc-900 group transition-colors">
                      <div className="p-1.5 rounded-full group-hover:bg-zinc-100 transition-colors -ml-1.5">
                        <BarChart2 size={18} />
                      </div>
                      <span className="text-[12px]">{post.viewCount > 0 ? post.viewCount : ''}</span>
                    </button>
                  </div>
                </div>
              </div>
            );
          }) : (
            <div className="text-center py-10 text-zinc-500 text-[14px]">
              <h3 className="font-bold text-lg text-zinc-900 mb-2">还没有帖子</h3>
              <p>当你发布帖子时，它会显示在这里。</p>
            </div>
          )}
        </div>
      </div>
    );
  };

  const renderNotifications = () => {
    const myNotifications = notifications.filter(n => n.userId === currentUser.id).sort((a, b) => b.timestamp - a.timestamp);
    
    return (
      <div className="bg-white min-h-full pb-20">
        <div className="px-4 pt-4 pb-3 bg-white/90 backdrop-blur-md sticky top-0 z-10 border-b border-zinc-100 flex items-center justify-between">
           <div className="text-lg font-bold text-zinc-900">通知</div>
           <button className="p-2 hover:bg-zinc-100 rounded-full transition-colors">
             <Settings size={20} className="text-zinc-900" />
           </button>
        </div>
        
        <div className="flex border-b border-zinc-100">
          <button className="flex-1 py-4 text-[14px] font-bold text-zinc-900 relative hover:bg-zinc-50 transition-colors">
            全部
            <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-12 h-1 bg-zinc-900 rounded-full" />
          </button>
          <button className="flex-1 py-4 text-[14px] font-bold text-zinc-500 relative hover:bg-zinc-50 transition-colors">
            已认证
          </button>
          <button className="flex-1 py-4 text-[14px] font-bold text-zinc-500 relative hover:bg-zinc-50 transition-colors">
            提及
          </button>
        </div>

        <div className="space-y-0">
          {myNotifications.map(n => {
            const sourceUser = getAuthor(n.sourceUserId);
            const post = posts.find(p => p.id === n.postId);
            
            let Icon = User;
            let iconColor = 'text-blue-500 fill-blue-500';
            let actionText = '';
            
            if (n.type === 'like_post' || n.type === 'like_comment') {
              Icon = Heart;
              iconColor = 'text-pink-500 fill-pink-500';
              actionText = '喜欢了你的帖子';
            } else if (n.type === 'reply') {
              Icon = MessageCircle;
              iconColor = 'text-zinc-900 fill-zinc-900';
              actionText = '回复了你的帖子';
            }

            return (
              <div 
                key={n.id} 
                onClick={() => {
                  if (post) {
                    setSelectedPostId(post.id);
                    setCurrentView('detail');
                  }
                }}
                className="bg-white p-4 border-b border-zinc-100 flex gap-3 hover:bg-zinc-50 transition-colors cursor-pointer"
              >
                <div className="w-10 flex justify-end pt-1">
                  <Icon size={24} className={iconColor} />
                </div>
                <div className="flex-1">
                  <img src={sourceUser.avatar} className="w-8 h-8 rounded-full object-cover mb-2" />
                  <p className="text-[14px] text-zinc-900 mb-2">
                    <span className="font-bold hover:underline">{sourceUser.name}</span>
                    <span className="text-zinc-500 ml-1">{actionText}</span>
                  </p>
                  {post && (
                    <div className="text-[15px] text-zinc-500 line-clamp-3">
                      {post.content}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
          {myNotifications.length === 0 && (
            <div className="text-center py-10 text-zinc-500 text-[14px]">
              <h3 className="font-bold text-lg text-zinc-900 mb-2">这里还没有任何内容</h3>
              <p>从喜欢到转发以及更多，这里是所有互动发生的地方。</p>
            </div>
          )}
        </div>
      </div>
    );
  };

  // --- Main Render ---

  if (currentView === 'detail') return renderPostDetail();
  if (currentView === 'editor') return renderEditor();
  if (currentView === 'user-profile') return renderUserProfile();

  return (
    <div className="h-full flex flex-col bg-white relative overflow-hidden">
      {/* Header */}
      {activeTab === 'home' && (
        <div className="px-4 pt-4 pb-2 bg-white/90 backdrop-blur-md sticky top-0 z-10 flex items-center justify-between border-b border-zinc-100">
          <button onClick={() => onClose()} className="p-2 -ml-2 hover:bg-zinc-100 rounded-full transition-colors">
            <ChevronLeft size={24} className="text-zinc-900" />
          </button>
          <div className="flex gap-6 text-[14px] font-bold">
            <button 
              onClick={() => setHomeFilter('latest')}
              className={`relative pb-3 ${homeFilter === 'latest' ? 'text-zinc-900' : 'text-zinc-500'} transition-all`}
            >
              为你推荐
              {homeFilter === 'latest' && <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-12 h-1 bg-zinc-900 rounded-full" />}
            </button>
            <button 
              onClick={() => setHomeFilter('hot')}
              className={`relative pb-3 ${homeFilter === 'hot' ? 'text-zinc-900' : 'text-zinc-500'} transition-all`}
            >
              正在关注
              {homeFilter === 'hot' && <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-12 h-1 bg-zinc-900 rounded-full" />}
            </button>
          </div>
          <div className="w-10" /> {/* Placeholder to balance the header */}
        </div>
      )}

      {/* Content Area */}
      <div className="flex-1 overflow-y-auto">
        {activeTab === 'home' && renderPostList()}
        {activeTab === 'hot' && renderHotList()}
        {activeTab === 'notification' && renderNotifications()}
        {activeTab === 'profile' && renderProfile()}
      </div>

      {/* Floating Action Button */}
      {activeTab === 'home' && (
        <button 
          onClick={() => {
            setEditingPostId(null);
            setEditorTitle('');
            setEditorContent('');
            setEditorImages([]);
            setCurrentView('editor');
          }}
          className="absolute bottom-20 right-4 w-14 h-14 bg-zinc-900 rounded-full shadow-lg flex items-center justify-center text-white hover:bg-zinc-800 transition-colors z-20"
        >
          <Plus size={28} strokeWidth={2.5} />
        </button>
      )}

      {/* Bottom Navigation */}
      <div className="bg-white px-6 py-2 flex justify-between items-center pb-0">
        <button 
          onClick={() => { setActiveTab('home'); setCurrentView('list'); }}
          className={`p-2 rounded-full transition-colors ${activeTab === 'home' ? 'text-zinc-900' : 'text-zinc-500 hover:bg-zinc-100'}`}
        >
          <Home size={26} fill={activeTab === 'home' ? 'currentColor' : 'none'} strokeWidth={activeTab === 'home' ? 0 : 2} />
        </button>
        <button 
          onClick={() => { setActiveTab('hot'); setCurrentView('list'); }}
          className={`p-2 rounded-full transition-colors ${activeTab === 'hot' ? 'text-zinc-900' : 'text-zinc-500 hover:bg-zinc-100'}`}
        >
          <Search size={26} strokeWidth={activeTab === 'hot' ? 3 : 2} />
        </button>
        <button 
          onClick={() => { setActiveTab('notification'); setCurrentView('list'); }}
          className={`p-2 rounded-full transition-colors relative ${activeTab === 'notification' ? 'text-zinc-900' : 'text-zinc-500 hover:bg-zinc-100'}`}
        >
          <Bell size={26} fill={activeTab === 'notification' ? 'currentColor' : 'none'} strokeWidth={activeTab === 'notification' ? 0 : 2} />
          {notifications.some(n => !n.read && n.userId === currentUser.id) && (
            <span className="absolute top-2 right-2 w-2 h-2 bg-zinc-900 rounded-full border border-white" />
          )}
        </button>
        <button 
          onClick={() => { setActiveTab('profile'); setCurrentView('list'); }}
          className={`p-2 rounded-full transition-colors ${activeTab === 'profile' ? 'text-zinc-900' : 'text-zinc-500 hover:bg-zinc-100'}`}
        >
          <Mail size={26} fill={activeTab === 'profile' ? 'currentColor' : 'none'} strokeWidth={activeTab === 'profile' ? 0 : 2} />
        </button>
      </div>

      {/* Share Modal */}
      {renderShareModal()}
    </div>
  );
}
