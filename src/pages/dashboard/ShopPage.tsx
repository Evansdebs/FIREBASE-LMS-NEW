import { useState, useEffect, useRef } from 'react';
import { useAuth } from '@/lib/auth-context';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  getShopItems, createShopItem, updateShopItem,
  deleteShopItem, toggleShopItemInterest
} from '@/lib/services/contentService';
import { getAllUsers, UserProfile } from '@/lib/services/userService';
import {
  ShoppingBag, Plus, Heart, Check, Trash2, Edit, Loader2, Tag,
  Clock, User, Store, CheckCircle, XCircle, AlertCircle, Phone,
  PhoneCall, Copy, MessageSquare, Upload, Image as ImageIcon,
  ChevronLeft, ChevronRight, X
} from 'lucide-react';
import { toast } from 'sonner';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { cn } from '@/lib/utils';

const CATEGORIES = ['ALL', 'GENERAL', 'BOOKS', 'STATIONERY', 'ELECTRONICS', 'UNIFORMS', 'ART_SUPPLIES', 'SPORTS', 'OTHER'];

const categoryLabel = (cat: string) => cat.replace(/_/g, ' ');

const statusConfig: Record<string, { color: string; icon: any; label: string }> = {
  APPROVED: { color: 'bg-emerald-500/10 text-emerald-600 border-emerald-200', icon: CheckCircle, label: 'Approved' },
  PENDING:  { color: 'bg-amber-500/10 text-amber-600 border-amber-200',   icon: Clock,        label: 'Pending Review' },
  REJECTED: { color: 'bg-rose-500/10 text-rose-600 border-rose-200',      icon: XCircle,      label: 'Rejected' },
};

// Helper to compress/optimize image file from device into base64 data URL
async function compressImageFile(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        let width = img.width;
        let height = img.height;
        const maxDim = 1200;
        if (width > maxDim || height > maxDim) {
          if (width > height) {
            height = Math.round((height * maxDim) / width);
            width = maxDim;
          } else {
            width = Math.round((width * maxDim) / height);
            height = maxDim;
          }
        }
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx?.drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL('image/jpeg', 0.82));
      };
      img.onerror = reject;
      img.src = e.target?.result as string;
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

export default function ShopPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const isAdmin   = user?.role === 'super_admin';
  const isTeacher = user?.role === 'teacher';

  const [items, setItems]               = useState<any[]>([]);
  const [myItems, setMyItems]           = useState<any[]>([]);
  const [pendingItems, setPendingItems] = useState<any[]>([]);
  const [allUsersMap, setAllUsersMap]   = useState<Map<string, UserProfile>>(new Map());
  const [loading, setLoading]           = useState(true);
  const [category, setCategory]         = useState('ALL');
  const [showCreate, setShowCreate]     = useState(false);
  const [editItem, setEditItem]         = useState<any>(null);
  const [deleteItem, setDeleteItem]     = useState<any>(null);
  const [interestItem, setInterestItem] = useState<any>(null);
  const [viewPhotosItem, setViewPhotosItem] = useState<any>(null);

  const fetchAll = async () => {
    setLoading(true);
    try {
      const [all, users] = await Promise.all([
        getShopItems(),
        getAllUsers().catch(() => [] as UserProfile[])
      ]);

      const userMap = new Map<string, UserProfile>();
      users.forEach(u => userMap.set(String(u.id), u));
      setAllUsersMap(userMap);

      const currentUid = String(user?.id || '');
      const processed = all.map(i => {
        const hasInterest = Boolean(i.interestedUsers && i.interestedUsers.includes(currentUid));
        const count = i.interestCount ?? (i.interestedUsers?.length || 0);
        return { ...i, hasInterest, interestCount: count };
      });

      const approved = processed.filter(i => i.status === 'APPROVED' && (category === 'ALL' || i.category === category));
      setItems(approved);

      if (isTeacher || isAdmin) {
        const mine = processed.filter(i => String(i.createdBy) === currentUid);
        setMyItems(mine);
      }
      if (isAdmin) {
        const pending = processed.filter(i => i.status === 'PENDING');
        setPendingItems(pending);
      }
    } catch { 
      toast.error('Failed to load shop items.'); 
    } finally { 
      setLoading(false); 
    }
  };

  useEffect(() => { 
    fetchAll(); 
  }, [category, user]);

  // Handle clicking the love/heart button: opens the seller info dialog and registers interest
  const handleLoveClick = async (item: any) => {
    setInterestItem(item);
    if (user?.id) {
      try {
        const isNowInterested = await toggleShopItemInterest(item.id, String(user.id));
        setItems(prev => prev.map(it => {
          if (it.id === item.id) {
            const newCount = isNowInterested ? (it.interestCount || 0) + 1 : Math.max(0, (it.interestCount || 1) - 1);
            return { ...it, hasInterest: isNowInterested, interestCount: newCount };
          }
          return it;
        }));
      } catch (e) {
        console.error("Interest toggle error:", e);
      }
    }
  };

  const handleApprove = async (id: string) => {
    try {
      await updateShopItem(id, { status: 'APPROVED' });
      toast.success('Item approved and now visible in the shop!');
      fetchAll();
    } catch { toast.error('Failed to approve.'); }
  };

  const handleReject = async (id: string) => {
    try {
      await updateShopItem(id, { status: 'REJECTED' });
      toast.success('Item rejected.');
      fetchAll();
    } catch { toast.error('Failed to reject.'); }
  };

  const handleDelete = async () => {
    if (!deleteItem) return;
    try {
      await deleteShopItem(deleteItem.id);
      toast.success('Item deleted.');
      setDeleteItem(null);
      fetchAll();
    } catch { toast.error('Failed to delete.'); }
  };

  // Helper to autogenerate username from email used when registering
  const getSellerInfo = (item: any) => {
    if (!item) return { username: 'seller', contactPhone: '', email: '', name: 'Seller' };
    const sellerUser = allUsersMap.get(String(item.createdBy));
    
    // Email used during registration
    const email = item.creatorEmail || sellerUser?.email || item.creator?.email || '';
    
    // Autogenerate username from email address
    let username = item.creatorUsername || '';
    if (!username && email && email.includes('@')) {
      username = email.split('@')[0].toLowerCase().replace(/[^a-z0-9_.-]/g, '');
    }
    if (!username) {
      const fallbackName = item.creator?.name || item.createdByName || sellerUser?.name || sellerUser?.fullName || 'seller';
      username = fallbackName.toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '');
    }

    const contactPhone = item.contactPhone || item.creator?.phone || sellerUser?.parentPhone || (sellerUser as any)?.phone || 'Not provided';
    const name = item.creator?.name || item.createdByName || sellerUser?.fullName || sellerUser?.name || 'Seller';

    return { username, contactPhone, email, name, userId: item.createdBy };
  };

  const sellerInfo = getSellerInfo(interestItem);

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-heading text-2xl font-bold text-foreground flex items-center gap-2">
            <Store className="w-6 h-6 text-primary" /> E-Store
          </h1>
          <p className="text-muted-foreground mt-1">Educational supplies, textbooks, uniforms, and resources marketplace</p>
        </div>
        <Button className="gap-2 shadow-lg shadow-primary/20" onClick={() => setShowCreate(true)}>
          <Plus className="w-4 h-4" /> List Item
        </Button>
      </div>

      {/* Admin pending badge */}
      {isAdmin && pendingItems.length > 0 && (
        <div className="flex items-center gap-3 p-3 bg-amber-500/10 border border-amber-300/30 rounded-xl">
          <AlertCircle className="w-5 h-5 text-amber-600 shrink-0" />
          <p className="text-sm text-amber-700 font-medium">
            {pendingItems.length} item{pendingItems.length > 1 ? 's' : ''} awaiting your approval
          </p>
        </div>
      )}

      <Tabs defaultValue="browse" className="space-y-4">
        <TabsList className="bg-muted/50 p-1">
          <TabsTrigger value="browse" className="gap-2"><ShoppingBag className="w-4 h-4" /> Browse</TabsTrigger>
          <TabsTrigger value="my-listings" className="gap-2"><Store className="w-4 h-4" /> My Listings</TabsTrigger>
          {isAdmin && (
            <TabsTrigger value="pending" className="gap-2 relative">
              <Clock className="w-4 h-4" /> Pending
              {pendingItems.length > 0 && (
                <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-amber-500 text-white text-[9px] flex items-center justify-center font-bold">
                  {pendingItems.length}
                </span>
              )}
            </TabsTrigger>
          )}
        </TabsList>

        {/* Browse Tab */}
        <TabsContent value="browse" className="space-y-4">
          {/* Category filter */}
          <div className="flex gap-2 flex-wrap">
            {CATEGORIES.map(cat => (
              <button
                key={cat}
                onClick={() => setCategory(cat)}
                className={cn(
                  'px-3 py-1.5 rounded-full text-xs font-medium border transition-all',
                  category === cat
                    ? 'bg-primary text-primary-foreground border-primary shadow-sm'
                    : 'bg-card border-border text-muted-foreground hover:border-primary/40'
                )}
              >
                {categoryLabel(cat)}
              </button>
            ))}
          </div>

          {loading ? (
            <div className="flex justify-center p-16"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>
          ) : items.length === 0 ? (
            <div className="py-20 text-center text-muted-foreground border border-dashed border-border rounded-2xl">
              <ShoppingBag className="w-12 h-12 mx-auto mb-4 opacity-20" />
              <p className="font-heading text-lg font-medium">No items available yet</p>
              <p className="text-sm mt-1">Check back soon or list educational resources and supplies!</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
              {items.map(item => (
                <ShopItemCard
                  key={item.id}
                  item={item}
                  onLoveClick={() => handleLoveClick(item)}
                  onViewPhotos={() => setViewPhotosItem(item)}
                  onEdit={isAdmin || String(item.createdBy) === String(user?.id) ? () => setEditItem(item) : undefined}
                  onDelete={isAdmin || String(item.createdBy) === String(user?.id) ? () => setDeleteItem(item) : undefined}
                  showActions={isAdmin || String(item.createdBy) === String(user?.id)}
                />
              ))}
            </div>
          )}
        </TabsContent>

        {/* My Listings Tab */}
        <TabsContent value="my-listings" className="space-y-4">
          {myItems.length === 0 ? (
            <div className="py-16 text-center text-muted-foreground border border-dashed border-border rounded-2xl">
              <Store className="w-12 h-12 mx-auto mb-4 opacity-20" />
              <p className="font-medium">You haven't listed any items yet.</p>
              <Button className="mt-4 gap-2" onClick={() => setShowCreate(true)}>
                <Plus className="w-4 h-4" /> List Your First Item
              </Button>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
              {myItems.map(item => (
                <ShopItemCard
                  key={item.id}
                  item={item}
                  showStatus
                  showActions
                  onLoveClick={() => handleLoveClick(item)}
                  onViewPhotos={() => setViewPhotosItem(item)}
                  onEdit={() => setEditItem(item)}
                  onDelete={() => setDeleteItem(item)}
                />
              ))}
            </div>
          )}
        </TabsContent>

        {/* Pending Approvals Tab */}
        {isAdmin && (
          <TabsContent value="pending" className="space-y-4">
            {pendingItems.length === 0 ? (
              <div className="py-16 text-center text-muted-foreground border border-dashed border-border rounded-2xl">
                <CheckCircle className="w-12 h-12 mx-auto mb-4 opacity-20" />
                <p className="font-medium">All caught up! No items awaiting approval.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {pendingItems.map(item => (
                  <Card key={item.id} className="border-border bg-card">
                    <CardContent className="p-4 flex items-center gap-4">
                      <div 
                        className="w-16 h-16 rounded-xl bg-muted flex items-center justify-center shrink-0 overflow-hidden cursor-pointer"
                        onClick={() => setViewPhotosItem(item)}
                      >
                        {item.imageUrl || (item.images && item.images[0])
                          ? <img src={item.imageUrl || item.images[0]} alt={item.title} className="w-full h-full object-cover" />
                          : <ShoppingBag className="w-6 h-6 text-muted-foreground" />
                        }
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-foreground truncate">{item.title}</p>
                        <p className="text-xs text-muted-foreground line-clamp-1">{item.description || 'No description'}</p>
                        <div className="flex items-center gap-2 mt-1">
                          <Badge variant="outline" className="text-[10px]">{categoryLabel(item.category)}</Badge>
                          <span className="text-xs text-muted-foreground flex items-center gap-1">
                            <User className="w-3 h-3" /> {item.createdByName || item.creator?.name}
                          </span>
                          <span className="text-xs font-bold text-primary">
                            {item.price > 0 ? `GH₵ ${Number(item.price).toFixed(2)}` : 'Free'}
                          </span>
                        </div>
                      </div>
                      <div className="flex gap-2 shrink-0">
                        <Button size="sm" className="gap-1 bg-emerald-600 hover:bg-emerald-700 text-white" onClick={() => handleApprove(item.id)}>
                          <Check className="w-3.5 h-3.5" /> Approve
                        </Button>
                        <Button size="sm" variant="outline" className="gap-1 text-destructive border-destructive/30 hover:bg-destructive/10" onClick={() => handleReject(item.id)}>
                          <XCircle className="w-3.5 h-3.5" /> Reject
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>
        )}
      </Tabs>

      {/* ─── LOVE BUTTON DIALOGUE BOX: SELLER USERNAME & CONTACT ───────── */}
      <Dialog open={!!interestItem} onOpenChange={(open) => !open && setInterestItem(null)}>
        <DialogContent className="max-w-md p-6">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 font-heading text-xl">
              <Heart className="w-5 h-5 text-rose-500 fill-rose-500" />
              Seller Contact & Information
            </DialogTitle>
            <DialogDescription>
              Connect directly with the poster of this educational item.
            </DialogDescription>
          </DialogHeader>

          {interestItem && (
            <div className="space-y-5 pt-2">
              {/* Product preview banner */}
              <div className="flex items-center gap-3 p-3 bg-muted/40 rounded-xl border border-border">
                <div className="w-14 h-14 rounded-lg bg-muted overflow-hidden shrink-0">
                  {interestItem.imageUrl || (interestItem.images && interestItem.images[0]) ? (
                    <img 
                      src={interestItem.imageUrl || interestItem.images[0]} 
                      alt={interestItem.title} 
                      className="w-full h-full object-cover" 
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-muted-foreground">
                      <ShoppingBag className="w-6 h-6" />
                    </div>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-sm text-foreground truncate">{interestItem.title}</p>
                  <p className="text-xs text-primary font-bold">
                    {interestItem.price > 0 ? `GH₵ ${Number(interestItem.price).toFixed(2)}` : 'Free'}
                  </p>
                  <Badge variant="outline" className="text-[10px] mt-1">{categoryLabel(interestItem.category)}</Badge>
                </div>
              </div>

              {/* Seller details */}
              <div className="space-y-3">
                {/* Autogenerated Username */}
                <div className="p-3 bg-primary/5 rounded-xl border border-primary/20 space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-muted-foreground font-medium">Seller Username</span>
                    <span className="text-[10px] text-muted-foreground">(generated from registration email)</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-base font-bold text-primary">
                      @{sellerInfo.username}
                    </span>
                  </div>
                </div>

                {/* Name and Email */}
                <div className="grid grid-cols-2 gap-2">
                  <div className="p-2.5 bg-muted/30 rounded-lg border border-border">
                    <p className="text-[10px] uppercase text-muted-foreground font-semibold">Posted By</p>
                    <p className="text-xs font-semibold text-foreground truncate">{sellerInfo.name}</p>
                  </div>
                  <div className="p-2.5 bg-muted/30 rounded-lg border border-border">
                    <p className="text-[10px] uppercase text-muted-foreground font-semibold">Email</p>
                    <p className="text-xs font-mono text-foreground truncate" title={sellerInfo.email || undefined}>
                      {sellerInfo.email || 'Registered LMS User'}
                    </p>
                  </div>
                </div>

                {/* Phone Contact */}
                <div className="p-3 bg-muted/30 rounded-xl border border-border space-y-2">
                  <span className="text-xs text-muted-foreground font-medium">Contact Number</span>
                  <div className="flex items-center justify-between">
                    <span className="text-base font-bold text-foreground font-mono">
                      {sellerInfo.contactPhone}
                    </span>
                    <div className="flex items-center gap-1.5">
                      {sellerInfo.contactPhone && sellerInfo.contactPhone !== 'Not provided' && (
                        <>
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-8 gap-1 text-xs"
                            onClick={() => {
                              navigator.clipboard.writeText(sellerInfo.contactPhone);
                              toast.success("Phone number copied to clipboard!");
                            }}
                          >
                            <Copy className="w-3.5 h-3.5" /> Copy
                          </Button>
                          <a
                            href={`tel:${sellerInfo.contactPhone}`}
                            className="inline-flex items-center justify-center gap-1 h-8 px-3 rounded-md text-xs font-semibold bg-emerald-600 hover:bg-emerald-700 text-white transition-colors shadow-sm"
                          >
                            <PhoneCall className="w-3.5 h-3.5" /> Call
                          </a>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* Direct LMS Chat Action */}
              <div className="pt-1 flex flex-col gap-2">
                {String(interestItem.createdBy) !== String(user?.id) && (
                  <Button 
                    className="w-full gap-2 shadow-md shadow-primary/20"
                    onClick={() => {
                      setInterestItem(null);
                      navigate(`/dashboard/messages?chatWith=${interestItem.createdBy}`);
                    }}
                  >
                    <MessageSquare className="w-4 h-4" /> Message Seller on LMS
                  </Button>
                )}
                <Button variant="outline" className="w-full" onClick={() => setInterestItem(null)}>
                  Close
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* ─── PHOTO GALLERY VIEWER MODAL ───────────────────────── */}
      <Dialog open={!!viewPhotosItem} onOpenChange={(open) => !open && setViewPhotosItem(null)}>
        <DialogContent className="max-w-2xl p-6">
          <DialogHeader>
            <DialogTitle className="font-heading text-lg">
              {viewPhotosItem?.title} - Pictures
            </DialogTitle>
            <DialogDescription>
              View detailed photos of this item.
            </DialogDescription>
          </DialogHeader>

          {viewPhotosItem && (
            <PhotoViewer item={viewPhotosItem} />
          )}
        </DialogContent>
      </Dialog>

      {/* Create/Edit Dialog */}
      <Dialog open={showCreate || !!editItem} onOpenChange={(o) => { if (!o) { setShowCreate(false); setEditItem(null); } }}>
        <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="font-heading">{editItem ? 'Edit Item' : 'List New Item'}</DialogTitle>
            <DialogDescription>Add item details and upload pictures from your device.</DialogDescription>
          </DialogHeader>
          <ShopItemForm
            item={editItem}
            onClose={() => { setShowCreate(false); setEditItem(null); }}
            onSuccess={() => { setShowCreate(false); setEditItem(null); fetchAll(); }}
            isAdmin={isAdmin}
          />
        </DialogContent>
      </Dialog>

      {/* Delete Confirm */}
      <AlertDialog open={!!deleteItem} onOpenChange={(o) => !o && setDeleteItem(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this item?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently remove <strong>{deleteItem?.title}</strong> from the shop.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

// ─── SHOP ITEM CARD ──────────────────────────────────────
function ShopItemCard({ item, onLoveClick, onViewPhotos, onEdit, onDelete, showStatus = false, showActions = false }: {
  item: any;
  onLoveClick?: () => void;
  onViewPhotos?: () => void;
  onEdit?: () => void;
  onDelete?: () => void;
  showStatus?: boolean;
  showActions?: boolean;
}) {
  const status = statusConfig[item.status] || statusConfig.PENDING;
  const StatusIcon = status.icon;
  const imageList = item.images && item.images.length > 0 ? item.images : (item.imageUrl ? [item.imageUrl] : []);
  const mainImage = imageList[0] || item.imageUrl;

  return (
    <Card className="group border-border bg-card hover:shadow-xl hover:shadow-primary/5 transition-all duration-300 overflow-hidden flex flex-col">
      {/* Image Preview with click to view gallery */}
      <div 
        className="aspect-[4/3] bg-muted relative overflow-hidden cursor-pointer"
        onClick={onViewPhotos}
        title="Click to view full pictures"
      >
        {mainImage ? (
          <img 
            src={mainImage} 
            alt={item.title} 
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" 
          />
        ) : (
          <div className="w-full h-full flex flex-col items-center justify-center text-muted-foreground/40 gap-1">
            <ShoppingBag className="w-12 h-12 group-hover:scale-110 transition-transform duration-300" />
            <span className="text-[11px]">No photo</span>
          </div>
        )}

        {/* Multiple photos count indicator */}
        {imageList.length > 1 && (
          <div className="absolute bottom-2 right-2 bg-black/70 text-white text-[10px] font-semibold px-2 py-0.5 rounded-full flex items-center gap-1 backdrop-blur-sm">
            <ImageIcon className="w-3 h-3" />
            {imageList.length} photos
          </div>
        )}

        {/* Category badge */}
        <div className="absolute top-3 left-3">
          <Badge className="bg-background/80 text-foreground border-border backdrop-blur-md text-[10px] px-2">
            <Tag className="w-2.5 h-2.5 mr-1" />{categoryLabel(item.category)}
          </Badge>
        </div>
        {showStatus && (
          <div className="absolute top-3 right-3">
            <span className={cn('inline-flex items-center gap-1 px-2 py-1 rounded-full text-[10px] font-semibold border backdrop-blur-md', status.color)}>
              <StatusIcon className="w-2.5 h-2.5" />{status.label}
            </span>
          </div>
        )}
      </div>

      <CardContent className="p-4 flex flex-col flex-1">
        <div className="flex-1">
          <h3 
            className="font-heading font-semibold text-card-foreground group-hover:text-primary transition-colors line-clamp-1 cursor-pointer"
            onClick={onViewPhotos}
          >
            {item.title}
          </h3>
          <p className="text-xs text-muted-foreground mt-1 line-clamp-2 min-h-[2.5rem]">{item.description || 'No description provided.'}</p>
        </div>

        <div className="mt-3 pt-3 border-t border-border flex items-center justify-between">
          <div>
            <p className="font-heading text-lg font-bold text-primary">
              {item.price > 0 ? `GH₵ ${Number(item.price).toFixed(2)}` : <span className="text-emerald-600">Free</span>}
            </p>
            <p className="text-[10px] text-muted-foreground flex items-center gap-1 mt-0.5">
              <User className="w-2.5 h-2.5" />{item.creator?.name || item.createdByName || 'Seller'}
            </p>
          </div>

          <div className="flex items-center gap-1.5">
            {showActions && onEdit && (
              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={onEdit} title="Edit Item">
                <Edit className="w-3.5 h-3.5" />
              </Button>
            )}
            {showActions && onDelete && (
              <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive hover:bg-destructive/10" onClick={onDelete} title="Delete Item">
                <Trash2 className="w-3.5 h-3.5" />
              </Button>
            )}

            {/* Love / Heart Button: opens dialogue box with seller username & contact */}
            {onLoveClick && (
              <button
                onClick={onLoveClick}
                title="Click to view seller contact & username"
                className={cn(
                  'flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold border transition-all duration-200 shrink-0 shadow-sm active:scale-95',
                  item.hasInterest
                    ? 'bg-rose-50 border-rose-200 text-rose-600 hover:bg-rose-100 dark:bg-rose-950 dark:border-rose-800 dark:text-rose-400'
                    : 'bg-card border-border text-muted-foreground hover:border-rose-300 hover:text-rose-500'
                )}
              >
                <Heart className={cn('w-3.5 h-3.5 transition-all', item.hasInterest && 'fill-rose-500 text-rose-500')} />
                <span>{item.interestCount ?? 0}</span>
              </button>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// ─── PHOTO VIEWER COMPONENT ─────────────────────────────
function PhotoViewer({ item }: { item: any }) {
  const images = item.images && item.images.length > 0 ? item.images : (item.imageUrl ? [item.imageUrl] : []);
  const [selectedIdx, setSelectedIdx] = useState(0);

  if (images.length === 0) {
    return (
      <div className="py-12 text-center text-muted-foreground">
        <ShoppingBag className="w-12 h-12 mx-auto mb-2 opacity-30" />
        <p>No photos uploaded for this item.</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Main photo display */}
      <div className="aspect-[16/10] bg-muted/80 rounded-xl overflow-hidden relative flex items-center justify-center border border-border">
        <img 
          src={images[selectedIdx]} 
          alt={`${item.title} photo ${selectedIdx + 1}`} 
          className="w-full h-full object-contain"
        />
        {images.length > 1 && (
          <>
            <button
              onClick={() => setSelectedIdx(prev => (prev > 0 ? prev - 1 : images.length - 1))}
              className="absolute left-2 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-black/60 text-white flex items-center justify-center hover:bg-black/80 transition-colors"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button
              onClick={() => setSelectedIdx(prev => (prev < images.length - 1 ? prev + 1 : 0))}
              className="absolute right-2 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-black/60 text-white flex items-center justify-center hover:bg-black/80 transition-colors"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </>
        )}
      </div>

      {/* Thumbnails strip */}
      {images.length > 1 && (
        <div className="flex gap-2 overflow-x-auto pb-1">
          {images.map((img: string, idx: number) => (
            <button
              key={idx}
              onClick={() => setSelectedIdx(idx)}
              className={cn(
                'w-16 h-16 rounded-lg overflow-hidden border-2 shrink-0 transition-all',
                selectedIdx === idx ? 'border-primary shadow-md scale-105' : 'border-transparent opacity-70 hover:opacity-100'
              )}
            >
              <img src={img} alt={`Thumb ${idx + 1}`} className="w-full h-full object-cover" />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── SHOP ITEM FORM (WITH LOCAL STORAGE UPLOAD & IMAGE LINK) ─────────
function ShopItemForm({ item, onClose, onSuccess, isAdmin }: {
  item?: any; onClose: () => void; onSuccess: () => void; isAdmin: boolean;
}) {
  const { user } = useAuth();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [form, setForm] = useState({
    title: item?.title || '',
    description: item?.description || '',
    price: item?.price?.toString() || '0',
    category: item?.category || 'GENERAL',
    imageUrl: item?.imageUrl || '',
    contactPhone: item?.contactPhone || '',
  });

  // Pictures state supporting multiple images from local storage or links
  const [selectedImages, setSelectedImages] = useState<string[]>(
    item?.images && item.images.length > 0 
      ? item.images 
      : (item?.imageUrl ? [item.imageUrl] : [])
  );
  const [imageUrlInput, setImageUrlInput] = useState('');
  const [uploadMethod, setUploadMethod] = useState<'storage' | 'link'>('storage');
  const [uploadingImage, setUploadingImage] = useState(false);
  const [loading, setLoading] = useState(false);

  // Maximum allowed file size: 5MB
  const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5 MB

  // Handle device file selection from local storage (max 5MB)
  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setUploadingImage(true);
    try {
      const newImages: string[] = [];
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        if (!file.type.startsWith('image/')) {
          toast.error(`"${file.name}" is not an image file.`);
          continue;
        }
        // Strict 5MB file size limit check
        if (file.size > MAX_FILE_SIZE) {
          toast.error(`"${file.name}" exceeds the maximum allowed size of 5MB (${(file.size / (1024 * 1024)).toFixed(1)}MB). Please choose a photo under 5MB.`);
          continue;
        }
        const compressedBase64 = await compressImageFile(file);
        newImages.push(compressedBase64);
      }

      if (newImages.length > 0) {
        setSelectedImages(prev => [...prev, ...newImages]);
        toast.success(`Added ${newImages.length} photo${newImages.length > 1 ? 's' : ''} from storage!`);
      }
    } catch (err: any) {
      toast.error('Failed to process image files.');
    } finally {
      setUploadingImage(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  // Add picture from web URL link
  const handleAddImageLink = () => {
    const trimmed = imageUrlInput.trim();
    if (!trimmed) {
      toast.error('Please enter a valid image URL.');
      return;
    }
    if (!trimmed.startsWith('http://') && !trimmed.startsWith('https://') && !trimmed.startsWith('data:image')) {
      toast.error('Image link must begin with http:// or https://');
      return;
    }
    setSelectedImages(prev => [...prev, trimmed]);
    setImageUrlInput('');
    toast.success('Image link added!');
  };

  const removeImage = (idx: number) => {
    setSelectedImages(prev => prev.filter((_, i) => i !== idx));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.title.trim()) return toast.error('Title is required.');
    if (!form.contactPhone.trim()) return toast.error('Contact phone number is required.');

    try {
      setLoading(true);

      const mainImageUrl = selectedImages.length > 0 ? selectedImages[0] : form.imageUrl;
      // Autogenerate username from user's registration email
      const userEmail = user?.email || '';
      const autogeneratedUsername = userEmail.includes('@') 
        ? userEmail.split('@')[0].toLowerCase().replace(/[^a-z0-9_.-]/g, '')
        : (user?.fullName || 'user').toLowerCase().replace(/\s+/g, '_');

      const payload = {
        ...form,
        price: Number(form.price) || 0,
        imageUrl: mainImageUrl,
        images: selectedImages,
        creatorEmail: userEmail,
        creatorUsername: autogeneratedUsername,
        creator: {
          name: user?.fullName || 'User',
          email: userEmail,
          phone: form.contactPhone,
          username: autogeneratedUsername,
        }
      };

      if (item) {
        await updateShopItem(item.id, payload);
        toast.success('Item updated successfully!');
      } else {
        await createShopItem({
          ...payload,
          status: isAdmin ? 'APPROVED' : 'PENDING',
          createdBy: String(user?.id || 'system'),
          createdByName: user?.fullName || 'User',
        });
        toast.success(isAdmin ? 'Item listed and approved!' : 'Item submitted for admin review!');
      }
      onSuccess();
    } catch (err: any) {
      toast.error(err.message || 'Failed to save item.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4 pt-2">
      <div className="space-y-2">
        <Label>Item Title *</Label>
        <Input 
          value={form.title} 
          onChange={e => setForm(p => ({ ...p, title: e.target.value }))} 
          placeholder="e.g. Ghana Basic School Atlas, Uniform Size 12, Calculator" 
          required 
        />
      </div>

      <div className="space-y-2">
        <Label>Description</Label>
        <Textarea 
          value={form.description} 
          onChange={e => setForm(p => ({ ...p, description: e.target.value }))} 
          rows={3} 
          placeholder="Describe the condition, edition, brand, or details..." 
          className="resize-none" 
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>Price (GH₵)</Label>
          <Input 
            type="number" 
            min="0" 
            step="0.01" 
            value={form.price} 
            onChange={e => setForm(p => ({ ...p, price: e.target.value }))} 
            placeholder="0.00 (leave 0 for free)" 
          />
        </div>
        <div className="space-y-2">
          <Label>Category</Label>
          <Select value={form.category} onValueChange={v => setForm(p => ({ ...p, category: v }))}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {CATEGORIES.filter(c => c !== 'ALL').map(c => (
                <SelectItem key={c} value={c}>{categoryLabel(c)}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="space-y-2">
        <Label>Contact Phone Number *</Label>
        <Input 
          value={form.contactPhone} 
          onChange={e => setForm(p => ({ ...p, contactPhone: e.target.value }))} 
          placeholder="e.g. 0241234567 or +233..." 
          type="tel" 
          required 
        />
        <p className="text-[11px] text-muted-foreground">
          Interested buyers clicking the Love button will see this phone number and your registered username.
        </p>
      </div>

      {/* ─── PICTURE UPLOAD SECTION (LOCAL STORAGE OR IMAGE LINK) ─── */}
      <div className="space-y-3 pt-2 border-t border-border">
        <div className="flex items-center justify-between">
          <Label className="flex items-center gap-1.5 font-medium">
            <ImageIcon className="w-4 h-4 text-primary" />
            Item Pictures ({selectedImages.length})
          </Label>
          <span className="text-[11px] text-muted-foreground">Max 5MB per photo</span>
        </div>

        {/* Method Toggle: Local Storage vs Image Link */}
        <div className="flex bg-muted/60 p-1 rounded-lg gap-1 border border-border">
          <button
            type="button"
            onClick={() => setUploadMethod('storage')}
            className={cn(
              'flex-1 flex items-center justify-center gap-1.5 py-1.5 px-3 rounded-md text-xs font-semibold transition-all',
              uploadMethod === 'storage'
                ? 'bg-card text-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground'
            )}
          >
            <Upload className="w-3.5 h-3.5 text-primary" />
            Local Storage (Max 5MB)
          </button>
          <button
            type="button"
            onClick={() => setUploadMethod('link')}
            className={cn(
              'flex-1 flex items-center justify-center gap-1.5 py-1.5 px-3 rounded-md text-xs font-semibold transition-all',
              uploadMethod === 'link'
                ? 'bg-card text-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground'
            )}
          >
            <Tag className="w-3.5 h-3.5 text-primary" />
            Image Link (URL)
          </button>
        </div>

        {/* Option A: Upload from Local Storage */}
        {uploadMethod === 'storage' && (
          <div>
            <input 
              type="file" 
              ref={fileInputRef} 
              onChange={handleFileChange} 
              accept="image/*" 
              multiple 
              className="hidden" 
              id="item-picture-input" 
            />

            <label
              htmlFor="item-picture-input"
              className="cursor-pointer border-2 border-dashed border-border hover:border-primary/50 bg-muted/20 hover:bg-muted/40 rounded-xl p-4 flex flex-col items-center justify-center gap-1.5 text-center transition-all"
            >
              {uploadingImage ? (
                <div className="flex items-center gap-2 py-2">
                  <Loader2 className="w-5 h-5 animate-spin text-primary" />
                  <span className="text-xs font-medium">Processing pictures...</span>
                </div>
              ) : (
                <>
                  <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-primary">
                    <Upload className="w-5 h-5" />
                  </div>
                  <p className="text-xs font-semibold text-foreground">Click to browse pictures from device storage</p>
                  <p className="text-[10px] text-muted-foreground">PNG, JPG, WebP supported • Maximum 5MB per photo</p>
                </>
              )}
            </label>
          </div>
        )}

        {/* Option B: Use Image Link */}
        {uploadMethod === 'link' && (
          <div className="space-y-2 p-3 bg-muted/20 rounded-xl border border-border">
            <Label className="text-xs text-muted-foreground">Paste direct image web link:</Label>
            <div className="flex gap-2">
              <Input
                value={imageUrlInput}
                onChange={e => setImageUrlInput(e.target.value)}
                placeholder="https://example.com/photos/item.jpg"
                className="text-xs h-9 flex-1"
                onKeyDown={e => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleAddImageLink();
                  }
                }}
              />
              <Button
                type="button"
                size="sm"
                variant="secondary"
                className="h-9 px-3 text-xs shrink-0"
                onClick={handleAddImageLink}
              >
                Add Link
              </Button>
            </div>
            <p className="text-[10px] text-muted-foreground">
              Enter any publicly accessible image URL and click Add Link.
            </p>
          </div>
        )}

        {/* Preview of attached pictures (from storage or link) */}
        {selectedImages.length > 0 && (
          <div className="space-y-1.5 pt-1">
            <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
              Selected Item Photos ({selectedImages.length})
            </p>
            <div className="grid grid-cols-3 sm:grid-cols-4 gap-2.5">
              {selectedImages.map((img, idx) => (
                <div key={idx} className="relative group rounded-lg overflow-hidden border border-border aspect-square bg-muted">
                  <img src={img} alt={`Photo ${idx + 1}`} className="w-full h-full object-cover" />
                  {idx === 0 && (
                    <span className="absolute top-1 left-1 bg-primary text-primary-foreground text-[9px] font-bold px-1.5 py-0.2 rounded shadow">
                      Cover
                    </span>
                  )}
                  <button
                    type="button"
                    onClick={() => removeImage(idx)}
                    className="absolute top-1 right-1 w-5 h-5 rounded-full bg-destructive text-white flex items-center justify-center opacity-80 hover:opacity-100 transition-opacity shadow"
                    title="Remove picture"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {!isAdmin && !item && (
        <div className="flex items-start gap-2 p-3 bg-amber-50 border border-amber-200 rounded-lg dark:bg-amber-950 dark:border-amber-800">
          <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
          <p className="text-xs text-amber-700 dark:text-amber-400">
            Your listing will be reviewed by an administrator before becoming visible in the public shop.
          </p>
        </div>
      )}

      <div className="flex justify-end gap-2 pt-3 border-t border-border">
        <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
        <Button type="submit" disabled={loading || uploadingImage} className="shadow-lg shadow-primary/20">
          {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : item ? 'Save Changes' : 'Submit Listing'}
        </Button>
      </div>
    </form>
  );
}


