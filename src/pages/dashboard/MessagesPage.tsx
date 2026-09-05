import { useState, useRef, useEffect } from 'react';
import { useAuth } from '@/lib/auth-context';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Send, Search, Circle, Loader2, XCircle, Plus, ChevronLeft } from 'lucide-react';
import { cn } from '@/lib/utils';
import { subscribeToConversation, sendMessage, MessageDoc } from '@/lib/services/messageService';
import { getAllUsers, UserProfile } from '@/lib/services/userService';
import { toast } from 'sonner';

export default function MessagesPage() {
  const { user } = useAuth();
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
          email: u.email,
          role: u.role,
          avatar: u.avatar || '',
        },
        lastMessage: null,
        unreadCount: 0,
      }));
      setConversations(convs);
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

  const handleDeleteMessage = async (messageId: string, senderId: string) => {
    if (senderId !== user?.id && user?.role !== 'super_admin') return;
    if (window.confirm("Delete this message?")) {
      try {
        const { deleteDoc, doc } = await import('firebase/firestore');
        const { db } = await import('@/lib/firebase');
        await deleteDoc(doc(db, 'messages', messageId));
        toast.success("Message deleted");
        setMessages(prev => prev.filter(m => m.id !== messageId));
      } catch (err: any) {
        toast.error(err.message || "Failed to delete message");
      }
    }
  };

  const filteredConvs = conversations.filter(c =>
    (c.partner?.name || '').toLowerCase().includes(searchConv.toLowerCase())
  );

  const handleSend = async () => {
    if (!newMessage.trim() || !selectedConv || !user) return;
    try {
      const partner = conversations.find(c => String(c.partner?.id) === String(selectedConv))?.partner;
      await sendMessage({
        senderId: String(user.id),
        senderName: user.fullName || user.name || 'User',
        receiverId: String(selectedConv),
        receiverName: partner?.name || 'User',
        message: newMessage.trim(),
      });
      setNewMessage('');
    } catch (err: any) {
      toast.error(err.message || 'Failed to send message');
    }
  };

  const currentConv = conversations.find(c => String(c.partner?.id) === selectedConv);

  const handleSearch = (query: string) => {
    setSearchQuery(query);
    if (!query.trim()) {
      setSearchResults([]);
      return;
    }
    const filtered = allUsers.filter(u =>
      (u.name || u.fullName || '').toLowerCase().includes(query.toLowerCase()) ||
      u.email.toLowerCase().includes(query.toLowerCase())
    );
    setSearchResults(filtered);
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
        <div className={cn("flex", isMobile ? "h-[calc(100vh-210px)]" : "h-[520px]")}>
          {/* Conversations list */}
          <div className={cn(
            "w-72 border-r border-border flex flex-col shrink-0 transition-all duration-300",
            isMobile && selectedConv && "hidden",
            isMobile && !selectedConv && "w-full border-r-0"
          )}>
            <div className="p-3 border-b border-border space-y-2">
              <Button 
                variant="outline" 
                className="w-full justify-start gap-2 h-9 text-sm" 
                onClick={() => setShowSearch(!showSearch)}
              >
                {showSearch ? <XCircle className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
                {showSearch ? 'Close Search' : 'New Message'}
              </Button>
              {showSearch ? (
                <div className="relative animate-in slide-in-from-top-2">
                  <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    placeholder="Name, email, or class..."
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
                    placeholder="Filter chats..."
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
                    {searchQuery ? 'Search Results' : 'All Users'}
                  </p>
                  {searchResults.length === 0 && !searching ? (
                    <p className="text-xs text-center text-muted-foreground py-4">No users found</p>
                  ) : (
                    searchResults.map(u => (
                      <button
                        key={u.id}
                        onClick={() => startNewChat(u)}
                        className="w-full flex items-center gap-2 p-2 hover:bg-primary/10 rounded-lg transition-colors text-left"
                      >
                         <div className="w-7 h-7 rounded-full bg-primary/20 flex items-center justify-center text-primary font-bold text-[10px]">
                           {u.name.charAt(0).toUpperCase()}
                         </div>
                         <div className="flex-1 min-w-0">
                           <p className="text-xs font-semibold truncate text-foreground">{u.name}</p>
                           <p className="text-[10px] text-muted-foreground truncate">{u.student?.class?.name || u.role}</p>
                         </div>
                      </button>
                    ))
                  )}
                </div>
              )}
              {loading ? (
                <div className="py-10 flex justify-center"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>
              ) : filteredConvs.length === 0 ? (
                <div className="py-10 text-center text-sm text-muted-foreground">No conversations yet</div>
              ) : (
                filteredConvs.map(conv => (
                  <button
                    key={conv.partner.id}
                    onClick={() => setSelectedConv(String(conv.partner.id))}
                    className={cn(
                      'w-full flex items-center gap-3 px-3 py-3 text-left hover:bg-muted/50 transition-colors border-b border-border',
                      selectedConv === String(conv.partner.id) && 'bg-primary/5'
                    )}
                  >
                    <div className="relative">
                      <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-primary font-semibold text-sm">
                        {(conv.partner?.name || '?').charAt(0).toUpperCase()}
                      </div>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between">
                        <p className="text-sm font-medium text-foreground truncate">{conv.partner?.name}</p>
                        <span className="text-[10px] text-muted-foreground shrink-0">
                          {conv.lastMessage?.createdAt ? new Date(conv.lastMessage.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}
                        </span>
                      </div>
                      <p className="text-xs text-muted-foreground truncate mt-0.5">{conv.lastMessage?.message}</p>
                    </div>
                    {conv.unreadCount > 0 && (
                      <Badge className="bg-primary text-primary-foreground text-[10px] h-5 min-w-5 flex items-center justify-center rounded-full px-1.5">
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
                <div className="px-4 py-3 border-b border-border flex items-center gap-3">
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
                  <div className="relative">
                    <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center text-primary font-semibold text-sm">
                      {(currentConv.partner?.name || '?').charAt(0).toUpperCase()}
                    </div>
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-foreground">{currentConv.partner?.name}</p>
                    <p className="text-[10px] text-muted-foreground uppercase tracking-wider">{currentConv.partner?.role.replace('_', ' ')}</p>
                  </div>
                </div>

                <div className="flex-1 overflow-y-auto p-4 space-y-3">
                  {msgLoading ? (
                    <div className="flex justify-center py-10"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>
                  ) : messages.map(msg => (
                    <div key={msg.id} className={cn('flex', msg.senderId === user?.id ? 'justify-end' : 'justify-start')}>
                      <div
                        onMouseDown={() => startPress(msg.id, msg.senderId)}
                        onMouseUp={endPress}
                        onMouseLeave={endPress}
                        onMouseMove={endPress}
                        onTouchStart={() => startPress(msg.id, msg.senderId)}
                        onTouchEnd={endPress}
                        onTouchMove={endPress}
                        className={cn(
                          'max-w-[70%] rounded-2xl px-4 py-2 cursor-pointer select-none transition-all active:scale-[0.98]',
                          msg.senderId === user?.id
                            ? 'bg-primary text-primary-foreground rounded-br-md shadow-sm hover:bg-primary/95'
                            : 'bg-muted text-foreground rounded-bl-md shadow-sm border border-border/50 hover:bg-muted/95'
                        )}
                        title={(msg.senderId === user?.id || user?.role === 'super_admin') ? "Long press to delete message" : undefined}
                      >
                        <p className="text-sm break-words whitespace-pre-wrap">{msg.message}</p>
                        <p className={cn('text-[10px] mt-1 text-right', msg.senderId === user?.id ? 'text-primary-foreground/70' : 'text-muted-foreground')}>
                          {new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </p>
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
                      placeholder="Type your message..."
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
              <div className="flex-1 flex flex-col items-center justify-center text-muted-foreground gap-3">
                <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center">
                  <span className="text-2xl">👋</span>
                </div>
                <p>Select a conversation to start chatting</p>
              </div>
            )}
          </div>
        </div>
      </Card>
    </div>
  );
}
