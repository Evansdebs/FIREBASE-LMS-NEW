import { useState, useEffect } from 'react';
import { useAuth } from '@/lib/auth-context';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import {
  getForumCategories, createForumCategory, getForumThreads,
  createForumThread, getForumPosts, createForumPost,
  ForumCategory, ForumThread, ForumPost
} from '@/lib/services/contentService';
import { getSubjects } from '@/lib/services/academicService';
import { MessageSquare, Pin, Lock, Trash2, ArrowLeft, Send, Search, Loader2, Plus } from 'lucide-react';
import { toast } from 'sonner';

export default function ForumPage() {
  const { user } = useAuth();
  const [categories, setCategories] = useState<any[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<any | null>(null);
  const [threads, setThreads] = useState<any[]>([]);
  const [selectedThread, setSelectedThread] = useState<any | null>(null);
  
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  
  const [showCreateThread, setShowCreateThread] = useState(false);
  const [showCreateCategory, setShowCreateCategory] = useState(false);
  const [newCategory, setNewCategory] = useState({ name: '', description: '' });
  const [newThread, setNewThread] = useState({ title: '', content: '' });
  const [newPost, setNewPost] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const canManage = ['teacher', 'admin', 'super_admin'].includes(user?.role || '');
  const canCreateForum = canManage || Boolean(user?.permissions?.create_forum);

  useEffect(() => {
    fetchCategories();
  }, []);

  useEffect(() => {
    if (selectedCategory) {
      fetchThreads(selectedCategory.id);
    }
  }, [selectedCategory]);

  useEffect(() => {
    if (selectedThread) {
      fetchThreadDetails(selectedThread.id);
    }
  }, [selectedThread?.id]);

  const fetchCategories = async () => {
    try {
      setLoading(true);
      let cats = await getForumCategories();
      if (cats.length === 0) {
        // Automatically populate default forum categories from subjects or defaults
        const subjects = await getSubjects();
        if (subjects.length > 0) {
          for (const sub of subjects.slice(0, 5)) {
            await createForumCategory({ name: `${sub.name} Discussion`, description: `Ask questions and discuss topics related to ${sub.name}`, subjectId: sub.id });
          }
          cats = await getForumCategories();
        } else {
          await createForumCategory({ name: 'General Discussion', description: 'General community chat, questions, and ideas' });
          await createForumCategory({ name: 'Homework Help', description: 'Collaborate with fellow students on assignments' });
          cats = await getForumCategories();
        }
      }
      setCategories(cats || []);
    } catch (err: any) {
      toast.error('Failed to load categories');
    } finally {
      setLoading(false);
    }
  };

  const fetchThreads = async (categoryId: string) => {
    try {
      setLoading(true);
      const res = await getForumThreads(categoryId);
      setThreads(res || []);
    } catch (err: any) {
      toast.error('Failed to load threads');
    } finally {
      setLoading(false);
    }
  };

  const fetchThreadDetails = async (threadId: string) => {
    try {
      const posts = await getForumPosts(threadId);
      setSelectedThread((prev: any) => ({ ...prev, posts }));
    } catch (err: any) {
      toast.error('Failed to load posts');
    }
  };

  const handleCreateCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCategory.name.trim()) return;
    try {
      setSubmitting(true);
      await createForumCategory({
        name: newCategory.name.trim(),
        description: newCategory.description.trim()
      });
      toast.success('Category created successfully');
      setShowCreateCategory(false);
      setNewCategory({ name: '', description: '' });
      fetchCategories();
    } catch (err: any) {
      toast.error(err.message || 'Failed to create category');
    } finally {
      setSubmitting(false);
    }
  };

  const handleCreateThread = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCategory || !user) return;
    try {
      setSubmitting(true);
      await createForumThread({
        categoryId: selectedCategory.id,
        categoryName: selectedCategory.name,
        authorId: user.id as string,
        authorName: user.fullName || (user as any).name || 'User',
        title: newThread.title,
        content: newThread.content,
        isPinned: false,
        isLocked: false,
      });
      toast.success('Topic created successfully');
      setShowCreateThread(false);
      setNewThread({ title: '', content: '' });
      fetchThreads(selectedCategory.id);
    } catch (err: any) {
      toast.error(err.message || 'Failed to create topic');
    } finally {
      setSubmitting(false);
    }
  };

  const handleCreatePost = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedThread || !newPost.trim() || !user) return;
    try {
      setSubmitting(true);
      await createForumPost({
        threadId: selectedThread.id,
        authorId: user.id as string,
        authorName: user.fullName || (user as any).name || 'User',
        content: newPost,
      });
      setNewPost('');
      fetchThreadDetails(selectedThread.id);
    } catch (err: any) {
      toast.error(err.message || 'Failed to post reply');
    } finally {
      setSubmitting(false);
    }
  };

  const handleModerateThread = async (threadId: string, data: any) => {
    try {
      const { updateDoc, doc } = await import('firebase/firestore');
      const { db } = await import('@/lib/firebase');
      await updateDoc(doc(db, 'forum_threads', threadId), data);
      toast.success('Thread updated');
      fetchThreads(selectedCategory.id);
      if (selectedThread?.id === threadId) {
        setSelectedThread({ ...selectedThread, ...data });
      }
    } catch (err: any) {
      toast.error('Moderation failed');
    }
  };

  const handleDeleteThread = async (threadId: string) => {
    if (!confirm('Delete this topic? This cannot be undone.')) return;
    try {
      const { deleteDoc, doc } = await import('firebase/firestore');
      const { db } = await import('@/lib/firebase');
      await deleteDoc(doc(db, 'forum_threads', threadId));
      toast.success('Topic deleted');
      if (selectedThread?.id === threadId) setSelectedThread(null);
      fetchThreads(selectedCategory.id);
    } catch (err: any) {
      toast.error('Deletion failed');
    }
  };

  const handleDeletePost = async (postId: string) => {
    if (!confirm('Delete this reply?')) return;
    try {
      const { deleteDoc, doc } = await import('firebase/firestore');
      const { db } = await import('@/lib/firebase');
      await deleteDoc(doc(db, 'forum_posts', postId));
      toast.success('Reply deleted');
      fetchThreadDetails(selectedThread.id);
    } catch (err: any) {
      toast.error('Deletion failed');
    }
  };

  // ─── THREAD VIEW ───────────────────────────────────────
  if (selectedThread) {
    const authorDisplayName = selectedThread.authorName || selectedThread.author?.name || 'User';
    return (
      <div className="space-y-6 max-w-4xl mx-auto min-h-[calc(100vh-100px)] flex flex-col">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 shrink-0 pb-2 border-b border-border">
          <div className="flex items-start sm:items-center gap-3">
            <Button variant="ghost" size="icon" onClick={() => setSelectedThread(null)} className="shrink-0 mt-0.5 sm:mt-0">
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <div>
              <h1 className="font-heading text-xl sm:text-2xl font-bold text-foreground flex items-center gap-2 flex-wrap">
                {selectedThread.isPinned && <Pin className="w-4 h-4 text-primary fill-primary" />}
                {selectedThread.isLocked && <Lock className="w-4 h-4 text-warning" />}
                {selectedThread.title}
              </h1>
              <p className="text-xs sm:text-sm text-muted-foreground mt-0.5">
                Started by <span className="font-medium text-foreground">{authorDisplayName}</span> · {new Date(selectedThread.createdAt).toLocaleDateString()}
              </p>
            </div>
          </div>
          {canManage && (
            <div className="flex flex-wrap items-center gap-2 pl-10 sm:pl-0">
              <Button size="sm" variant="outline" onClick={() => handleModerateThread(selectedThread.id, { isPinned: !selectedThread.isPinned })}>
                {selectedThread.isPinned ? 'Unpin' : 'Pin'}
              </Button>
              <Button size="sm" variant="outline" onClick={() => handleModerateThread(selectedThread.id, { isLocked: !selectedThread.isLocked })}>
                {selectedThread.isLocked ? 'Unlock' : 'Lock'}
              </Button>
              <Button size="sm" variant="destructive" onClick={() => handleDeleteThread(selectedThread.id)}>
                Delete Topic
              </Button>
            </div>
          )}
        </div>

        <div className="flex-1 overflow-y-auto space-y-4 px-1 pb-4">
          <Card className="border-border">
            <CardContent className="p-4 sm:p-5 flex gap-3 sm:gap-4">
              <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-full bg-primary/10 flex items-center justify-center font-bold text-primary shrink-0 text-sm">
                {selectedThread.author?.profileImage ? (
                  <img src={`${import.meta.env.VITE_API_URL || 'http://localhost:5000'}/${selectedThread.author.profileImage}`} className="w-full h-full rounded-full object-cover" alt="" />
                ) : authorDisplayName.charAt(0).toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex flex-wrap items-center justify-between gap-1 mb-2">
                  <span className="font-semibold text-sm sm:text-base text-foreground">{authorDisplayName}</span>
                  <span className="text-[11px] text-muted-foreground">{new Date(selectedThread.createdAt).toLocaleString()}</span>
                </div>
                <div className="text-sm text-foreground/90 whitespace-pre-wrap leading-relaxed">{selectedThread.content}</div>
              </div>
            </CardContent>
          </Card>

          {selectedThread.posts?.map((post: any) => {
            const postAuthor = post.authorName || post.author?.name || 'User';
            return (
              <Card key={post.id} className="border-border ml-3 sm:ml-8">
                <CardContent className="p-3 sm:p-4 flex gap-3 sm:gap-4">
                  <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-muted flex items-center justify-center font-bold text-muted-foreground shrink-0 text-xs">
                    {post.author?.profileImage ? (
                      <img src={`${import.meta.env.VITE_API_URL || 'http://localhost:5000'}/${post.author.profileImage}`} className="w-full h-full rounded-full object-cover" alt="" />
                    ) : postAuthor.charAt(0).toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2 mb-1.5">
                      <span className="font-medium text-xs sm:text-sm text-foreground">{postAuthor}</span>
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] sm:text-xs text-muted-foreground">{new Date(post.createdAt).toLocaleString()}</span>
                        {(canManage || post.authorId === user?.id) && (
                          <button onClick={() => handleDeletePost(post.id)} className="text-destructive hover:underline text-xs">Delete</button>
                        )}
                      </div>
                    </div>
                    <div className="text-sm text-foreground/90 whitespace-pre-wrap leading-relaxed">{post.content}</div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>

        <div className="shrink-0 mt-2 pt-2 border-t border-border">
          {selectedThread.isLocked && !canManage ? (
            <div className="p-4 bg-muted/30 text-center text-muted-foreground rounded-lg border border-border flex items-center justify-center gap-2 text-sm">
              <Lock className="w-4 h-4" /> This topic is locked and closed to new replies.
            </div>
          ) : (
            <form onSubmit={handleCreatePost} className="flex flex-col sm:flex-row gap-2">
              <Textarea 
                value={newPost} 
                onChange={e => setNewPost(e.target.value)}
                placeholder="Write a reply..." 
                className="resize-none min-h-[70px] flex-1 text-sm"
                required
              />
              <Button type="submit" className="h-10 sm:h-auto shrink-0 gap-2" disabled={submitting}>
                {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                Reply
              </Button>
            </form>
          )}
        </div>
      </div>
    );
  }

  // ─── THREAD LIST VIEW ────────────────────────────────────
  if (selectedCategory) {
    return (
      <div className="space-y-6 max-w-5xl mx-auto">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" onClick={() => setSelectedCategory(null)} className="shrink-0">
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <div>
              <h1 className="font-heading text-xl sm:text-2xl font-bold text-foreground">{selectedCategory.name}</h1>
              <p className="text-xs sm:text-sm text-muted-foreground">{selectedCategory.description || 'Discussions in this category'}</p>
            </div>
          </div>
          {canCreateForum && (
            <Dialog open={showCreateThread} onOpenChange={setShowCreateThread}>
              <DialogTrigger asChild>
                <Button className="gap-2 shrink-0 self-start sm:self-auto"><MessageSquare className="w-4 h-4" /> New Topic</Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-lg">
                <DialogHeader><DialogTitle className="font-heading">Create New Topic</DialogTitle></DialogHeader>
                <form onSubmit={handleCreateThread} className="space-y-4 py-3">
                  <div className="space-y-2">
                    <span className="text-sm font-medium">Title</span>
                    <Input value={newThread.title} onChange={e => setNewThread(p => ({ ...p, title: e.target.value }))} placeholder="What is your topic or question?" required />
                  </div>
                  <div className="space-y-2">
                    <span className="text-sm font-medium">Message</span>
                    <Textarea value={newThread.content} onChange={e => setNewThread(p => ({ ...p, content: e.target.value }))} placeholder="Explain your question or start the discussion..." required rows={5} className="resize-none" />
                  </div>
                  <Button type="submit" className="w-full" disabled={submitting}>
                    {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Post Topic'}
                  </Button>
                </form>
              </DialogContent>
            </Dialog>
          )}
        </div>

        <div className="space-y-3">
          {loading ? (
            <div className="py-12 flex justify-center"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>
          ) : threads.length === 0 ? (
            <div className="py-12 text-center text-muted-foreground border border-dashed rounded-lg bg-muted/10 p-6">
              <p className="font-medium">No topics found in this category.</p>
              <p className="text-xs mt-1">Be the first to start a discussion!</p>
            </div>
          ) : (
            threads.map(thread => {
              const authorName = thread.authorName || thread.author?.name || 'User';
              const replyCount = thread.postCount ?? thread._count?.posts ?? 0;
              return (
                <Card key={thread.id} className="hover:bg-muted/5 transition-colors cursor-pointer border-border" onClick={() => setSelectedThread(thread)}>
                  <CardContent className="p-4 flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3 sm:gap-4 min-w-0">
                      <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                        <MessageSquare className="w-4 h-4 sm:w-5 sm:h-5 text-primary" />
                      </div>
                      <div className="min-w-0">
                        <h3 className="font-semibold text-sm sm:text-base text-foreground flex items-center gap-1.5 truncate">
                          {thread.isPinned && <Pin className="w-3.5 h-3.5 text-primary fill-primary shrink-0" />}
                          {thread.isLocked && <Lock className="w-3.5 h-3.5 text-warning shrink-0" />}
                          <span className="truncate">{thread.title}</span>
                        </h3>
                        <p className="text-xs text-muted-foreground mt-0.5 truncate">
                          Started by {authorName} · {new Date(thread.createdAt).toLocaleDateString()}
                        </p>
                      </div>
                    </div>
                    <div className="shrink-0 text-right">
                      <Badge variant="outline" className="text-xs py-0.5 px-2 font-normal">
                        {replyCount} {replyCount === 1 ? 'Reply' : 'Replies'}
                      </Badge>
                    </div>
                  </CardContent>
                </Card>
              );
            })
          )}
        </div>
      </div>
    );
  }

  // ─── CATEGORY LIST VIEW ─────────────────────────────────
  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="font-heading text-2xl font-bold text-foreground">Discussion Forums</h1>
          <p className="text-muted-foreground text-xs sm:text-sm mt-0.5">Join the conversation in your subjects and classes</p>
        </div>
        {canCreateForum && (
          <Dialog open={showCreateCategory} onOpenChange={setShowCreateCategory}>
            <DialogTrigger asChild>
              <Button className="gap-2 shrink-0 self-start sm:self-auto"><Plus className="w-4 h-4" /> New Category</Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-md">
              <DialogHeader><DialogTitle className="font-heading">Create Forum Category</DialogTitle></DialogHeader>
              <form onSubmit={handleCreateCategory} className="space-y-4 py-3">
                <div className="space-y-2">
                  <span className="text-sm font-medium">Category Name</span>
                  <Input value={newCategory.name} onChange={e => setNewCategory(p => ({ ...p, name: e.target.value }))} placeholder="e.g. Science & Technology" required />
                </div>
                <div className="space-y-2">
                  <span className="text-sm font-medium">Description</span>
                  <Textarea value={newCategory.description} onChange={e => setNewCategory(p => ({ ...p, description: e.target.value }))} placeholder="Describe the topics discussed here..." rows={3} className="resize-none" />
                </div>
                <Button type="submit" className="w-full" disabled={submitting}>
                  {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Create Category'}
                </Button>
              </form>
            </DialogContent>
          </Dialog>
        )}
      </div>

      <div className="relative">
        <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
        <Input placeholder="Search forum categories..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {loading ? (
          <div className="col-span-full py-12 flex justify-center"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>
        ) : categories.filter(c => c.name.toLowerCase().includes(search.toLowerCase())).map(category => (
          <Card key={category.id} className="cursor-pointer hover:shadow-md transition-all group border-border" onClick={() => setSelectedCategory(category)}>
            <CardContent className="p-5">
              <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                <MessageSquare className="w-6 h-6 text-primary" />
              </div>
              <h3 className="font-heading text-lg font-semibold text-foreground mb-1 group-hover:text-primary transition-colors">{category.name}</h3>
              <p className="text-xs text-muted-foreground line-clamp-2 mb-3">{category.description || 'Discussion topics and questions'}</p>
              <p className="text-xs font-medium text-primary/80">{category.threadCount || 0} Discussions</p>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
