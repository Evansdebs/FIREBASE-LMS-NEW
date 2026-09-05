import { useState, useEffect, useRef } from 'react';
import { useAuth } from '@/lib/auth-context';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  getShopItems, createShopItem, updateShopItem,
  deleteShopItem, ShopItem
} from '@/lib/services/contentService';
import {
  ShoppingBag, Plus, Heart, Check, Trash2, Edit, Loader2, Tag,
  Eye, Clock, User, Store, CheckCircle, XCircle, AlertCircle, Phone
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

export default function ShopPage() {
  const { user } = useAuth();
  const isAdmin   = user?.role === 'super_admin';
  const isTeacher = user?.role === 'teacher';

  const [items, setItems]             = useState<any[]>([]);
  const [myItems, setMyItems]         = useState<any[]>([]);
  const [pendingItems, setPendingItems] = useState<any[]>([]);
  const [loading, setLoading]         = useState(true);
  const [category, setCategory]       = useState('ALL');
  const [showCreate, setShowCreate]   = useState(false);
  const [editItem, setEditItem]       = useState<any>(null);
  const [deleteItem, setDeleteItem]   = useState<any>(null);
  const [interestItem, setInterestItem] = useState<any>(null);

  const fetchAll = async () => {
    setLoading(true);
    try {
      const all = await getShopItems();
      const approved = all.filter(i => i.status === 'APPROVED' && (category === 'ALL' || i.category === category));
      setItems(approved);
      if (isTeacher || isAdmin) {
        const mine = all.filter(i => i.createdBy === user?.id);
        setMyItems(mine);
      }
      if (isAdmin) {
        const pending = all.filter(i => i.status === 'PENDING');
        setPendingItems(pending);
      }
    } catch { toast.error('Failed to load shop.'); }
    finally { setLoading(false); }
  };

  useEffect(() => { fetchAll(); }, [category, user]);

  const handleInterest = async (item: any) => {
    toast.success(`Contact seller at: ${item.contactPhone || 'Available upon request'}`);
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

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-heading text-2xl font-bold text-foreground flex items-center gap-2">
            <Store className="w-6 h-6 text-primary" /> E-Store
          </h1>
          <p className="text-muted-foreground mt-1">Educational resources and supplies marketplace</p>
        </div>
        {(isAdmin || isTeacher) && (
          <Button className="gap-2 shadow-lg shadow-primary/20" onClick={() => setShowCreate(true)}>
            <Plus className="w-4 h-4" /> List Item
          </Button>
        )}
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
          {(isAdmin || isTeacher) && (
            <TabsTrigger value="my-listings" className="gap-2"><Store className="w-4 h-4" /> My Listings</TabsTrigger>
          )}
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
              <p className="text-sm mt-1">Check back soon for educational resources and supplies!</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
              {items.map(item => (
                <ShopItemCard
                  key={item.id}
                  item={item}
                  onInterest={() => handleInterest(item)}
                  onEdit={isAdmin ? () => setEditItem(item) : undefined}
                  onDelete={isAdmin ? () => setDeleteItem(item) : undefined}
                  showActions={isAdmin}
                />
              ))}
            </div>
          )}
        </TabsContent>

        {/* My Listings Tab */}
        {(isAdmin || isTeacher) && (
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
                    onEdit={() => setEditItem(item)}
                    onDelete={() => setDeleteItem(item)}
                  />
                ))}
              </div>
            )}
          </TabsContent>
        )}

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
                      <div className="w-14 h-14 rounded-xl bg-muted flex items-center justify-center shrink-0 overflow-hidden">
                        {item.imageUrl
                          ? <img src={item.imageUrl} alt={item.title} className="w-full h-full object-cover" />
                          : <ShoppingBag className="w-6 h-6 text-muted-foreground" />
                        }
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-foreground truncate">{item.title}</p>
                        <p className="text-xs text-muted-foreground line-clamp-1">{item.description || 'No description'}</p>
                        <div className="flex items-center gap-2 mt-1">
                          <Badge variant="outline" className="text-[10px]">{categoryLabel(item.category)}</Badge>
                          <span className="text-xs text-muted-foreground flex items-center gap-1">
                            <User className="w-3 h-3" /> {item.creator?.name}
                          </span>
                          <span className="text-xs font-bold text-primary">
                            {item.price > 0 ? `GH₵ ${item.price.toFixed(2)}` : 'Free'}
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

      {/* Create/Edit Dialog */}
      <Dialog open={showCreate || !!editItem} onOpenChange={(o) => { if (!o) { setShowCreate(false); setEditItem(null); } }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="font-heading">{editItem ? 'Edit Item' : 'List New Item'}</DialogTitle>
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
function ShopItemCard({ item, onInterest, onEdit, onDelete, showStatus = false, showActions = false }: {
  item: any;
  onInterest?: () => void;
  onEdit?: () => void;
  onDelete?: () => void;
  showStatus?: boolean;
  showActions?: boolean;
}) {
  const status = statusConfig[item.status] || statusConfig.PENDING;
  const StatusIcon = status.icon;

  return (
    <Card className="group border-border bg-card hover:shadow-xl hover:shadow-primary/5 transition-all duration-300 overflow-hidden flex flex-col">
      {/* Image */}
      <div className="aspect-[4/3] bg-muted relative overflow-hidden">
        {item.imageUrl ? (
          <img src={item.imageUrl} alt={item.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <ShoppingBag className="w-12 h-12 text-muted-foreground/30 group-hover:scale-110 transition-transform duration-300" />
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
          <h3 className="font-heading font-semibold text-card-foreground group-hover:text-primary transition-colors line-clamp-1">{item.title}</h3>
          <p className="text-xs text-muted-foreground mt-1 line-clamp-2 min-h-[2.5rem]">{item.description || 'No description provided.'}</p>
        </div>

        <div className="mt-3 pt-3 border-t border-border flex items-center justify-between">
          <div>
            <p className="font-heading text-lg font-bold text-primary">
              {item.price > 0 ? `GH₵ ${item.price.toFixed(2)}` : <span className="text-emerald-600">Free</span>}
            </p>
            {item.creator && (
              <p className="text-[10px] text-muted-foreground flex items-center gap-1 mt-0.5">
                <User className="w-2.5 h-2.5" />{item.creator.name}
              </p>
            )}
          </div>

          <div className="flex items-center gap-1.5">
            {showActions && onEdit && (
              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={onEdit}>
                <Edit className="w-3.5 h-3.5" />
              </Button>
            )}
            {showActions && onDelete && (
              <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive hover:bg-destructive/10" onClick={onDelete}>
                <Trash2 className="w-3.5 h-3.5" />
              </Button>
            )}
            {onInterest && (
              <div className="flex items-center gap-2">
                {item.hasInterest && item.contactPhone && (
                  <a href={`tel:${item.contactPhone}`} title="Call Seller" className="text-[10px] bg-emerald-50 text-emerald-700 px-2.5 py-1.5 rounded-full flex items-center gap-1 font-bold hover:bg-emerald-100 border border-emerald-200 transition-colors shadow-sm dark:bg-emerald-950 dark:border-emerald-800 dark:text-emerald-400 shrink-0">
                    <Phone className="w-3 h-3" /> {item.contactPhone}
                  </a>
                )}
                <button
                  onClick={onInterest}
                  className={cn(
                    'flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold border transition-all duration-200 shrink-0',
                    item.hasInterest
                      ? 'bg-rose-50 border-rose-200 text-rose-600 hover:bg-rose-100 dark:bg-rose-950 dark:border-rose-800 dark:text-rose-400'
                      : 'bg-card border-border text-muted-foreground hover:border-rose-300 hover:text-rose-500'
                  )}
                >
                  <Heart className={cn('w-3.5 h-3.5 transition-all', item.hasInterest && 'fill-current')} />
                  {item.interestCount ?? 0}
                </button>
              </div>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// ─── SHOP ITEM FORM ──────────────────────────────────────
function ShopItemForm({ item, onClose, onSuccess, isAdmin }: {
  item?: any; onClose: () => void; onSuccess: () => void; isAdmin: boolean;
}) {
  const { user } = useAuth();
  const [form, setForm] = useState({
    title: item?.title || '',
    description: item?.description || '',
    price: item?.price?.toString() || '0',
    category: item?.category || 'GENERAL',
    imageUrl: item?.imageUrl || '',
    contactPhone: item?.contactPhone || '',
  });
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.title.trim()) return toast.error('Title is required.');
    if (!form.contactPhone.trim()) return toast.error('Contact phone number is required.');
    try {
      setLoading(true);
      if (item) {
        await updateShopItem(item.id, {
          ...form,
          price: Number(form.price) || 0,
        });
        toast.success('Item updated!');
      } else {
        await createShopItem({
          ...form,
          price: Number(form.price) || 0,
          status: isAdmin ? 'APPROVED' : 'PENDING',
          createdBy: user?.id as string || 'system',
          createdByName: user?.fullName || user?.name || 'User',
        });
        toast.success(isAdmin ? 'Item listed and approved!' : 'Item submitted for approval!');
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
        <Input value={form.title} onChange={e => setForm(p => ({ ...p, title: e.target.value }))} placeholder="e.g. Ghana Basic School Atlas" required />
      </div>
      <div className="space-y-2">
        <Label>Description</Label>
        <Textarea value={form.description} onChange={e => setForm(p => ({ ...p, description: e.target.value }))} rows={3} placeholder="Describe the item..." className="resize-none" />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>Price (GH₵)</Label>
          <Input type="number" min="0" step="0.01" value={form.price} onChange={e => setForm(p => ({ ...p, price: e.target.value }))} placeholder="0.00" />
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
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>Contact Phone *</Label>
          <Input value={form.contactPhone} onChange={e => setForm(p => ({ ...p, contactPhone: e.target.value }))} placeholder="e.g. 0241234567" type="tel" required />
        </div>
        <div className="space-y-2">
          <Label>Image URL (optional)</Label>
          <Input value={form.imageUrl} onChange={e => setForm(p => ({ ...p, imageUrl: e.target.value }))} placeholder="https://..." />
        </div>
      </div>
      {!isAdmin && !item && (
        <div className="flex items-start gap-2 p-3 bg-amber-50 border border-amber-200 rounded-lg dark:bg-amber-950 dark:border-amber-800">
          <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
          <p className="text-xs text-amber-700 dark:text-amber-400">Your listing will be reviewed by an admin before it appears in the shop.</p>
        </div>
      )}
      <div className="flex justify-end gap-2 pt-2">
        <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
        <Button type="submit" disabled={loading} className="shadow-lg shadow-primary/20">
          {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : item ? 'Save Changes' : 'Submit Listing'}
        </Button>
      </div>
    </form>
  );
}
