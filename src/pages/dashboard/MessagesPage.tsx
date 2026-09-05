import { useState, useRef, useEffect } from 'react';
import { useAuth } from '@/lib/auth-context';
import { useSearchParams } from 'react-router-dom';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Send, Search, Loader2, XCircle, Plus, ChevronLeft, Trash2, Mail, User as UserIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import { subscribeToConversation, sendMessage } from '@/lib/services/messageService';
import { getAllUsers, UserProfile } from '@/lib/services/userService';
import { api } from '@/lib/api';
import { doc, deleteDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { toast } from 'sonner';

export default function MessagesPage() {
  const { user } = useAuth();
  const [searchParams] = useSearchParams();
  const initialChatWith = searchParams.get('chatWith') || searchParams.get('userId');

  const [conversations, setConversations] = useState<any[]>([]);
  const [selectedConv, setSelectedConv] = useState<string | null>(null);
  const [messages, setMessages] = useState<any[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [searchConv, setSearchConv] = useState('');
  const [loading, setLoading] = useState(true);
  const [msgLoading, setMsgLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [allUsers, setAllUsers] = useState<UserProfile[]>([]);
  const [searching, setSearching] = useState(false);
  const [showSearch, setShowSearch] = useState(false);
  const [isMobile, setIsMobile] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const pressTimerRef = useRef<any>(null);

  useEffect(() => {
    fetchUsersAndConversations();

    const checkMobile = () => setIsMobile(window.innerWidth < 768);
    checkMobile();
    window.addEventListener('resize', checkMobile);

    return () => {
      window.removeEventListener('resize', checkMobile);
    };
  }, [user]);

  const fetchUsersAndConversations = async () => {
    try {
      setLoading(true);
      const users = await getAllUsers();
      const currentUid = String(user?.id || '');
      const otherUsers = users.filter(u => String(u.id) !== currentUid);
      setAllUsers(otherUsers);
      
      const convs = otherUsers.map(u => ({
        partner: {
          id: String(u.id),
          name: u.name || u.fullName || u.email || 'User',
          email: u.email || '',
          role: u.role || 'STUDENT',
          avatar: u.avatar || '',
          className: u.className || '',
        },
        lastMessage: null,
        unreadCount: 0,
      }));
      setConversations(convs);

      // Auto-select chat recipient if specified in URL
      if (initialChatWith) {
        const found = convs.find(c => String(c.partner.id) === String(initialChatWith));
        if (found) {
          setSelectedConv(String(found.partner.id));
        } else {
          const targetUser = otherUsers.find(u => String(u.id) === String(initialChatWith));
          if (targetUser) {
            startNewChat({
              id: String(targetUser.id),
              name: targetUser.name || targetUser.fullName || targetUser.email,
              email: targetUser.email,
              role: targetUser.role,
              avatar: targetUser.avatar || '',
              className: targetUser.className,
            });
          }
        }
      }
    } catch (err: any) {
      toast.error(err.message || 'Failed to load contacts');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!selectedConv || !user) return;
    setMsgLoading(true);
    const unsub = subscribeToConversation(user.id as string, selectedConv, (msgs) => {
      setMessages(msgs);
      setMsgLoading(false);
    });
    return unsub;
  }, [selectedConv, user]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Clean format for timestamps
  const formatTime = (dateStr?: string) => {
    if (!dateStr) return '';
    try {
      const d = new Date(dateStr);
      return isNaN(d.getTime()) ? '' : d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } catch {
      return '';
    }
  };

  // Long press timer for message deletion
  const startPress = (messageId: string, senderId: string) => {
    if (senderId !== user?.id && user?.role !== 'super_admin') return;
    endPress();
    pressTimerRef.current = setTimeout(() => {
      handleDeleteMessage(messageId, senderId);
    }, 700);
  };

  const endPress = () => {
    if (pressTimerRef.current) {
      clearTimeout(pressTimerRef.current);
      pressTimerRef.current = null;
    }
  };

  const handleDeleteMessage = async (messageId: string, senderId: string) => {
    if (senderId !== user?.id && user?.role !== 'super_admin') return;
    if (window.confirm("Delete this message?")) {
      try {
        await deleteDoc(doc(db, 'messages', messageId));
        toast.success("Message deleted");
        setMessages(prev => prev.filter(m => m.id !== messageId));
      } catch (err: any) {
        toast.error(err.message || "Failed to delete message");
      }
    }
  };

  // Search existing chats by partner name OR partner email
  const filteredConvs = conversations.filter(c => {
    const q = searchConv.toLowerCase().trim();
    if (!q) return true;
    const name = (c.partner?.name || '').toLowerCase();
    const email = (c.partner?.email || '').toLowerCase();
    return name.includes(q) || email.includes(q);
  });

  const handleSend = async () => {
    if (!newMessage.trim() || !selectedConv || !user) return;
    try {
      const partner = conversations.find(c => String(c.partner?.id) === String(selectedConv))?.partner;
      await sendMessage({
        senderId: String(user.id),
        senderName: user.fullName || 'User',
        receiverId: String(selectedConv),
        message: newMessage.trim(),
      });
      setNewMessage('');
    } catch (err: any) {
      toast.error(err.message || 'Failed to send message');
    }
  };

  const currentConv = conversations.find(c => String(c.partner?.id) === selectedConv);

  // Search new users by both name and email
  const handleSearch = (query: string) => {
    setSearchQuery(query);
    const q = query.toLowerCase().trim();
    if (!q) {
      setSearchResults([]);
      return;
    }
    setSearching(true);
    const filtered = allUsers.filter(u => {
      const name = (u.name || u.fullName || '').toLowerCase();
      const email = (u.email || '').toLowerCase();
      return name.includes(q) || email.includes(q);
    });
    setSearchResults(filtered);
    setSearching(false);
  };

  const startNewChat = (partner: any) => {
    const existing = conversations.find(c => String(c.partner.id) === String(partner.id));
    if (existing) {
      setSelectedConv(String(partner.id));
    } else {
      setConversations(prev => [
        {
          partner,
          lastMessage: null,
          unreadCount: 0
        },
        ...prev
      ]);
      setSelectedConv(String(partner.id));
    }
    setShowSearch(false);
    setSearchQuery('');
    setSearchResults([]);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-heading text-2xl font-bold text-foreground">Messages</h1>
          <p className="text-muted-foreground mt-1">Chat securely within the LMS</p>
        </div>
        {user?.role === 'super_admin' && (
          <Button 
            variant="destructive" 
            size="sm" 
            className="gap-2"
            onClick={async () => {
              if (window.confirm("CRITICAL WARNING: This will permanently delete EVERY message in the entire platform. This action is irreversible. Proceed?")) {
                try {
                  await api.delete('/api/messages/delete-all');
                  toast.success("Message history cleared successfully.");
                  setConversations([]);
                  setMessages([]);
                  setSelectedConv(null);
                } catch (err: any) {
                  toast.error(err.message || "Failed to clear messages.");
                }
              }
            }}
          >
            <XCircle className="w-4 h-4" />
            Clear All History
          </Button>
        )}
      </div>

      <Card className="border-border overflow-hidden">
        <div className={cn("flex", isMobile ? "h-[calc(100vh-210px)]" : "h-[560px]")}>
          {/* Conversations list */}
          <div className={cn(
            "w-80 border-r border-border flex flex-col shrink-0 transition-all duration-300",
            isMobile && selectedConv && "hidden",
            isMobile && !selectedConv && "w-full border-r-0"
          )}>
            <div className="p-3 border-b border-border space-y-2">
              <Button 
                variant="outline" 
                className="w-full justify-start gap-2 h-9 text-sm" 
                onClick={() => {
                  setShowSearch(!showSearch);
                  if (!showSearch) {
                    setSearchQuery('');
                    setSearchResults([]);
                  }
                }}
              >
                {showSearch ? <XCircle className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
                {showSearch ? 'Close Search' : 'New Message'}
              </Button>
              {showSearch ? (
                <div className="relative animate-in slide-in-from-top-2">
                  <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    placeholder="Search by name or email..."
                    value={searchQuery}
                    onChange={e => handleSearch(e.target.value)}
                    className="pl-9 h-9 text-sm"
                    autoFocus
                  />
                  {searching && <Loader2 className="w-3 h-3 absolute right-3 top-1/2 -translate-y-1/2 animate-spin text-primary" />}
                </div>
              ) : (
                <div className="relative">
                  <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    placeholder="Filter by name or email..."
                    value={searchConv}
                    onChange={e => setSearchConv(e.target.value)}
                    className="pl-9 h-9 text-sm"
                  />
                </div>
              )}
            </div>
            <div className="flex-1 overflow-y-auto">
              {showSearch && (
                <div className="bg-muted/30 border-b border-border p-2 space-y-1">
                  <p className="text-[10px] uppercase font-bold text-muted-foreground px-2 mb-1">
                    {searchQuery ? `Matching Users (${searchResults.length})` : 'Type email or name to find user'}
                  </p>
                  {searchResults.length === 0 && !searching && searchQuery ? (
                    <p className="text-xs text-center text-muted-foreground py-4">No users found with this email or name</p>
                  ) : (
                    searchResults.map(u => (
                      <button
                        key={u.id}
                        onClick={() => startNewChat({
                          id: String(u.id),
                          name: u.name || u.fullName || u.email,
                          email: u.email,
                          role: u.role,
                          avatar: u.avatar || '',
                          className: u.className || '',
                        })}
                        className="w-full flex items-center gap-2 p-2 hover:bg-primary/10 rounded-lg transition-colors text-left"
                      >
                         <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center text-primary font-bold text-xs shrink-0 overflow-hidden border border-border">
                           {u.avatar ? (
                             <img src={u.avatar} alt={u.name || u.fullName} className="w-full h-full object-cover" />
                           ) : (
                             (u.name || u.fullName || u.email || '?').charAt(0).toUpperCase()
                           )}
                         </div>
                         <div className="flex-1 min-w-0">
                           <div className="flex items-center justify-between gap-1">
                             <p className="text-xs font-semibold truncate text-foreground">{u.name || u.fullName}</p>
                             <Badge variant="outline" className="text-[9px] px-1 py-0 uppercase shrink-0">
                               {u.role?.replace('_', ' ')}
                             </Badge>
                           </div>
                           <p className="text-[11px] text-primary font-mono truncate flex items-center gap-1">
                             <Mail className="w-2.5 h-2.5 shrink-0" />
                             {u.email}
                           </p>
                           {u.className && (
                             <p className="text-[10px] text-muted-foreground truncate">Class: {u.className}</p>
                           )}
                         </div>
                      </button>
                    ))
                  )}
                </div>
              )}
              {loading ? (
                <div className="py-10 flex justify-center"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>
              ) : filteredConvs.length === 0 ? (
                <div className="py-10 text-center text-sm text-muted-foreground">No conversations found</div>
              ) : (
                filteredConvs.map(conv => (
                  <button
                    key={conv.partner.id}
                    onClick={() => setSelectedConv(String(conv.partner.id))}
                    className={cn(
                      'w-full flex items-center gap-3 px-3 py-3 text-left hover:bg-muted/50 transition-colors border-b border-border',
                      selectedConv === String(conv.partner.id) && 'bg-primary/10 border-l-2 border-l-primary'
                    )}
                  >
                    <div className="relative shrink-0">
                      <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-primary font-semibold text-sm overflow-hidden border border-border">
                        {conv.partner?.avatar ? (
                          <img src={conv.partner.avatar} alt={conv.partner.name} className="w-full h-full object-cover" />
                        ) : (
                          (conv.partner?.name || '?').charAt(0).toUpperCase()
                        )}
                      </div>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-1">
                        <p className="text-sm font-medium text-foreground truncate">{conv.partner?.name}</p>
                        <span className="text-[10px] text-muted-foreground shrink-0">
                          {formatTime(conv.lastMessage?.createdAt)}
                        </span>
                      </div>
                      {/* Distinguish multiple students with same name by displaying their unique email */}
                      <p className="text-[11px] text-muted-foreground truncate font-mono flex items-center gap-1 mt-0.5">
                        <Mail className="w-2.5 h-2.5 shrink-0 opacity-70" />
                        <span className="truncate">{conv.partner?.email || 'No email'}</span>
                      </p>
                      {conv.lastMessage?.message && (
                        <p className="text-xs text-muted-foreground/80 truncate mt-0.5">{conv.lastMessage.message}</p>
                      )}
                    </div>
                    {conv.unreadCount > 0 && (
                      <Badge className="bg-primary text-primary-foreground text-[10px] h-5 min-w-5 flex items-center justify-center rounded-full px-1.5 shrink-0">
                        {conv.unreadCount}
                      </Badge>
                    )}
                  </button>
                ))
              )}
            </div>
          </div>

          {/* Chat area */}
          <div className={cn(
            "flex-1 flex flex-col transition-all duration-300",
            isMobile && !selectedConv && "hidden"
          )}>
            {selectedConv && currentConv ? (
              <>
                <div className="px-4 py-3 border-b border-border flex items-center justify-between">
                  <div className="flex items-center gap-3 min-w-0">
                    {isMobile && (
                      <Button 
                        variant="ghost" 
                        size="icon" 
                        onClick={() => setSelectedConv(null)}
                        className="mr-1 h-8 w-8 -ml-2"
                      >
                        <ChevronLeft className="w-5 h-5" />
                      </Button>
                    )}
                    <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-primary font-semibold text-sm shrink-0 overflow-hidden border border-border">
                      {currentConv.partner?.avatar ? (
                        <img src={currentConv.partner.avatar} alt={currentConv.partner.name} className="w-full h-full object-cover" />
                      ) : (
                        (currentConv.partner?.name || '?').charAt(0).toUpperCase()
                      )}
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-semibold text-foreground truncate">{currentConv.partner?.name}</p>
                        {currentConv.partner?.role && (
                          <Badge variant="outline" className="text-[9px] px-1.5 py-0 uppercase">
                            {currentConv.partner.role.replace('_', ' ')}
                          </Badge>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground font-mono flex items-center gap-1 truncate mt-0.5">
                        <Mail className="w-3 h-3 shrink-0 text-primary" />
                        <span className="truncate">{currentConv.partner?.email}</span>
                      </p>
                    </div>
                  </div>
                </div>

                <div className="flex-1 overflow-y-auto p-4 space-y-3">
                  {msgLoading ? (
                    <div className="flex justify-center py-10"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>
                  ) : messages.length === 0 ? (
                    <div className="text-center py-12 text-muted-foreground text-sm">
                      <p>No messages yet. Send a message to start chatting!</p>
                    </div>
                  ) : messages.map(msg => (
                    <div key={msg.id} className={cn('flex group', msg.senderId === user?.id ? 'justify-end' : 'justify-start')}>
                      <div className="relative max-w-[75%] flex items-end gap-1.5">
                        {/* Option to delete message on hover or tap for authorized sender/admin */}
                        {(msg.senderId === user?.id || user?.role === 'super_admin') && (
                          <button
                            type="button"
                            onClick={() => handleDeleteMessage(msg.id, msg.senderId)}
                            className="opacity-0 group-hover:opacity-100 transition-opacity p-1 text-muted-foreground hover:text-destructive rounded hover:bg-muted"
                            title="Delete message"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                        <div
                          onMouseDown={() => startPress(msg.id, msg.senderId)}
                          onMouseUp={endPress}
                          onMouseLeave={endPress}
                          onTouchStart={() => startPress(msg.id, msg.senderId)}
                          onTouchEnd={endPress}
                          onTouchCancel={endPress}
                          className={cn(
                            'rounded-2xl px-4 py-2 select-none transition-all shadow-sm',
                            msg.senderId === user?.id
                              ? 'bg-primary text-primary-foreground rounded-br-md hover:bg-primary/95'
                              : 'bg-muted text-foreground rounded-bl-md border border-border/50 hover:bg-muted/95'
                          )}
                          title={(msg.senderId === user?.id || user?.role === 'super_admin') ? "Hold or click trash icon to delete" : undefined}
                        >
                          <p className="text-sm break-words whitespace-pre-wrap">{msg.message}</p>
                          <p className={cn('text-[10px] mt-1 text-right', msg.senderId === user?.id ? 'text-primary-foreground/75' : 'text-muted-foreground')}>
                            {formatTime(msg.createdAt)}
                          </p>
                        </div>
                      </div>
                    </div>
                  ))}
                  <div ref={messagesEndRef} />
                </div>

                <div className="p-3 border-t border-border">
                  <form onSubmit={e => { e.preventDefault(); handleSend(); }} className="flex gap-2">
                    <Input
                      value={newMessage}
                      onChange={e => setNewMessage(e.target.value)}
                      placeholder={`Message ${currentConv.partner?.name || 'user'} (${currentConv.partner?.email || ''})...`}
                      className="flex-1"
                      autoFocus
                    />
                    <Button type="submit" size="icon" disabled={!newMessage.trim()}>
                      <Send className="w-4 h-4" />
                    </Button>
                  </form>
                </div>
              </>
            ) : (
              <div className="flex-1 flex flex-col items-center justify-center text-muted-foreground gap-3 p-6 text-center">
                <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center text-2xl">
                  👋
                </div>
                <h3 className="font-semibold text-foreground">Direct LMS Messages</h3>
                <p className="text-xs max-w-sm">
                  Select a student or teacher from the list, or search by name and email to start chatting.
                </p>
              </div>
            )}
          </div>
        </div>
      </Card>
    </div>
  );
}
