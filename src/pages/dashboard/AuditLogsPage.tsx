import { useState, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Search, Download, FileText, AlertCircle, Shield, ArrowRight, Loader2, Trash2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { getAuditLogs, deleteAuditLog } from '@/lib/services/settingsService';
import { toast } from 'sonner';

export default function AuditLogsPage() {
  const [logs, setLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [actionFilter, setActionFilter] = useState('all');

  useEffect(() => {
    fetchLogs();
  }, []);

  const fetchLogs = async () => {
    try {
      setLoading(true);
      const res = await getAuditLogs(200);
      setLogs(res);
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteLog = async (id: string) => {
    if (!window.confirm('Are you sure you want to delete this log entry?')) return;
    try {
      await deleteAuditLog(id);
      toast.success('Log entry deleted');
      setLogs(prev => prev.filter(log => log.id !== id));
    } catch (err: any) {
      toast.error(err.message || 'Failed to delete log entry');
    }
  };

  const filtered = logs.filter(log => {
    const matchSearch =
      (log.action || '').toLowerCase().includes(search.toLowerCase()) ||
      (log.details || '').toLowerCase().includes(search.toLowerCase()) ||
      (log.user?.name || 'System').toLowerCase().includes(search.toLowerCase());
    const matchAction = actionFilter === 'all' || (log.action || '').toLowerCase().includes(actionFilter);
    return matchSearch && matchAction;
  });

  const uniqueActions = ['login', 'create', 'update', 'delete', 'upload'];

  const actionIcon = (action: string) => {
    const l = action.toLowerCase();
    if (l.includes('login')) return <Shield className="w-4 h-4 text-info" />;
    if (l.includes('delete') || l.includes('fail')) return <AlertCircle className="w-4 h-4 text-destructive" />;
    return <FileText className="w-4 h-4 text-muted-foreground" />;
  };

  const actionColor = (action: string) => {
    const l = action.toLowerCase();
    if (l.includes('login')) return 'bg-info/10 text-info border-info/20';
    if (l.includes('create') || l.includes('upload')) return 'bg-success/10 text-success border-success/20';
    if (l.includes('update')) return 'bg-warning/10 text-warning border-warning/20';
    if (l.includes('delete') || l.includes('fail')) return 'bg-destructive/10 text-destructive border-destructive/20';
    return 'bg-muted text-muted-foreground border-border';
  };

  const handleExportCSV = () => {
    if (filtered.length === 0) return toast.error('No logs to export');
    const headers = ['Timestamp', 'User', 'Role', 'Action', 'Details', 'IP Address'];
    const rows = filtered.map(log => [
      `"${new Date(log.createdAt).toLocaleString()}"`,
      `"${log.user?.name || 'System'}"`,
      `"${log.user?.role || ''}"`,
      `"${log.action || ''}"`,
      `"${(log.details || '').replace(/"/g, '""')}"`,
      `"${log.ipAddress || ''}"`
    ]);
    const csvContent = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `audit_logs_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-heading text-2xl font-bold text-foreground">Audit Logs</h1>
          <p className="text-muted-foreground mt-1">
            {loading ? 'Loading...' : `${filtered.length} total entries`}
          </p>
        </div>
        <Button variant="outline" className="gap-2" onClick={handleExportCSV}><Download className="w-4 h-4" /> Export CSV</Button>
      </div>

      <Card className="border-border">
        <CardContent className="p-4">
          <div className="flex flex-wrap gap-3">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <Input placeholder="Search logs..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
            </div>
            <Select value={actionFilter} onValueChange={setActionFilter}>
              <SelectTrigger className="w-[160px]"><SelectValue placeholder="Action Type" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Actions</SelectItem>
                {uniqueActions.map(a => <SelectItem key={a} value={a} className="capitalize">{a}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      <Card className="border-border overflow-hidden">
        {loading ? (
          <div className="py-20 flex justify-center"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-border bg-muted/50">
                  <th className="text-left text-xs font-semibold text-muted-foreground px-4 py-3">Timestamp</th>
                  <th className="text-left text-xs font-semibold text-muted-foreground px-3 py-3">User</th>
                  <th className="text-left text-xs font-semibold text-muted-foreground px-3 py-3">Action</th>
                  <th className="text-left text-xs font-semibold text-muted-foreground px-3 py-3 min-w-[300px]">Details</th>
                  <th className="text-right text-xs font-semibold text-muted-foreground px-4 py-3">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(log => (
                  <tr key={log.id} className="border-b border-border hover:bg-muted/30 transition-colors">
                    <td className="px-4 py-3 text-sm text-foreground whitespace-nowrap">
                      {new Date(log.createdAt).toLocaleString()}
                    </td>
                    <td className="px-3 py-3">
                      <div className="flex items-center gap-2">
                        <div className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center text-primary font-semibold text-[10px]">
                          {(log.user?.name || 'S').charAt(0).toUpperCase()}
                        </div>
                        <span className="text-sm font-medium text-foreground">{log.user?.name || 'System'}</span>
                        {log.user?.role && (
                          <Badge variant="outline" className="text-[10px] px-1 py-0">{log.user.role}</Badge>
                        )}
                      </div>
                    </td>
                    <td className="px-3 py-3">
                      <Badge variant="outline" className={cn('gap-1', actionColor(log.action))}>
                        {actionIcon(log.action)}
                        <span className="capitalize">{log.action}</span>
                      </Badge>
                    </td>
                    <td className="px-3 py-3">
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <ArrowRight className="w-3 h-3 mt-0.5 shrink-0" />
                        <span className="line-clamp-2">{log.details || '-'}</span>
                      </div>
                      {log.ipAddress && (
                        <p className="text-[10px] text-muted-foreground/60 mt-1 ml-5">IP: {log.ipAddress}</p>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                        onClick={() => handleDeleteLog(log.id)}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </td>
                  </tr>
                ))}
                {filtered.length === 0 && (
                  <tr><td colSpan={5} className="text-center py-8 text-muted-foreground">No audit logs found matching your criteria</td></tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}
