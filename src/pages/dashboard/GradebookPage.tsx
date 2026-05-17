import { useState, useEffect } from 'react';
import { useAuth } from '@/lib/auth-context';
import ExcelJS from 'exceljs';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Search, Download, TrendingUp, TrendingDown, Minus, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { api } from '@/lib/api';
import { toast } from 'sonner';

export default function GradebookPage() {
  const { user } = useAuth();
  const isAdmin = user?.role === 'super_admin';
  const [gradebook, setGradebook] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [classFilter, setClassFilter] = useState('all');
  const [subjectFilter, setSubjectFilter] = useState('all');

  useEffect(() => {
    fetchGradebook();
  }, []);

  const fetchGradebook = async () => {
    try {
      setLoading(true);
      const endpoint = isAdmin ? '/api/admin/gradebook' : '/api/teacher/gradebook';
      const res = await api.get(endpoint);
      setGradebook(Array.isArray(res) ? res : []);
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setLoading(false);
    }
  };

  // Derive unique classes and subjects for filters
  const classes = [...new Set(gradebook.map(g => g.className).filter(Boolean))];
  const allSubjects = [...new Set(gradebook.flatMap(g => 
    (g.results || []).map((r: any) => r.quiz?.course?.subject?.name)
  ).filter(Boolean))];

  // Process data based on filters
  const filtered = gradebook.map(student => {
    let results = student.results || [];
    
    // Apply subject filter to the results first
    if (subjectFilter !== 'all') {
      results = results.filter((r: any) => r.quiz?.course?.subject?.name === subjectFilter);
    }

    // Recalculate stats for this student based on filtered results
    const count = results.length;
    const totalScore = results.reduce((sum: number, r: any) => sum + (r.score || 0), 0);
    const average = count > 0 ? Math.round(totalScore / count) : 0;

    return {
      ...student,
      displayResults: results,
      displayCount: count,
      displayAverage: average
    };
  }).filter(g => {
    const matchSearch = (g.studentName || '').toLowerCase().includes(search.toLowerCase());
    const matchClass = classFilter === 'all' || g.className === classFilter;
    const hasData = subjectFilter === 'all' || g.displayCount > 0;
    return matchSearch && matchClass && hasData;
  });

  const classAvg = filtered.length > 0
    ? Math.round(filtered.reduce((sum, g) => sum + (g.displayAverage || 0), 0) / filtered.length)
    : 0;

  const gradeColor = (grade: number | null) => {
    if (grade === null || grade === undefined) return 'text-muted-foreground';
    if (grade >= 90) return 'text-success font-semibold';
    if (grade >= 75) return 'text-info';
    if (grade >= 50) return 'text-warning';
    return 'text-destructive';
  };

  const handleExport = async () => {
    if (filtered.length === 0) return toast.error('No grades to export');
    toast.loading('Generating premium Excel report...');
    try {
      const workbook = new ExcelJS.Workbook();
      workbook.creator = 'ONEREAL LMS';
      workbook.created = new Date();

      // -------------- SHEET 1: SUMMARY --------------
      const summarySheetName = subjectFilter === 'all' ? 'Summary Overview' : `${subjectFilter} Summary`;
      const summarySheet = workbook.addWorksheet(summarySheetName);
      
      summarySheet.columns = [
        { header: 'Student Name', key: 'name', width: 25 },
        { header: 'Email Address', key: 'email', width: 30 },
        { header: 'Class', key: 'class', width: 15 },
        { header: 'Quizzes Taken', key: 'count', width: 15 },
        { header: 'Average Score (%)', key: 'average', width: 20 },
      ];

      summarySheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
      summarySheet.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF2563EB' } };
      summarySheet.getRow(1).alignment = { vertical: 'middle', horizontal: 'center' };

      filtered.forEach(student => {
        const row = summarySheet.addRow({
          name: student.studentName,
          email: student.email,
          class: student.className,
          count: student.displayCount,
          average: student.displayAverage,
        });
        row.alignment = { vertical: 'middle', horizontal: 'left' };
      });
      
      summarySheet.autoFilter = 'A1:E1';

      // -------------- SHEET 2: DETAILED RESULTS --------------
      const detailSheet = workbook.addWorksheet('Detailed Results');
      
      detailSheet.columns = [
        { header: 'Student Name', key: 'name', width: 25 },
        { header: 'Class', key: 'class', width: 15 },
        { header: 'Subject', key: 'subject', width: 25 },
        { header: 'Quiz Title', key: 'quiz', width: 30 },
        { header: 'Score (%)', key: 'score', width: 15 },
        { header: 'Date Submitted', key: 'date', width: 25 },
      ];

      detailSheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
      detailSheet.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF10B981' } };
      detailSheet.getRow(1).alignment = { vertical: 'middle', horizontal: 'center' };

      let detailRowCount = 1;
      filtered.forEach(student => {
        student.displayResults.forEach((r: any) => {
          detailSheet.addRow({
            name: student.studentName,
            class: student.className,
            subject: r.quiz?.course?.subject?.name || 'N/A',
            quiz: r.quiz?.title || 'Unknown Quiz',
            score: r.score || 0,
            date: r.submittedAt ? new Date(r.submittedAt).toLocaleString() : 'N/A',
          });
          detailRowCount++;
        });
      });

      detailSheet.autoFilter = `A1:F${Math.max(1, detailRowCount)}`;

      const buffer = await workbook.xlsx.writeBuffer();
      const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      
      let filename = 'gradebook_export';
      if (classFilter !== 'all') filename += `_${classFilter.replace(/\s+/g, '_')}`;
      if (subjectFilter !== 'all') filename += `_${subjectFilter.replace(/\s+/g, '_')}`;
      if (search) filename += `_filtered`;
      filename += `_${new Date().toISOString().split('T')[0]}.xlsx`;
      
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      
      toast.dismiss();
      toast.success('Premium Excel report downloaded!');
    } catch (err: any) {
      toast.dismiss();
      toast.error('Failed to export: ' + err.message);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-heading text-2xl font-bold text-foreground">Gradebook</h1>
          <p className="text-muted-foreground mt-1">
            {loading ? 'Loading...' : `${filtered.length} students`}
          </p>
        </div>
        <Button variant="outline" className="gap-2" onClick={handleExport}><Download className="w-4 h-4" /> Export Grades</Button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        <Card className="border-border"><CardContent className="p-4">
          <p className="text-xs text-muted-foreground">Students</p>
          <p className="font-heading text-2xl font-bold text-card-foreground">{filtered.length}</p>
        </CardContent></Card>
        <Card className="border-border"><CardContent className="p-4">
          <p className="text-xs text-muted-foreground">
            {subjectFilter === 'all' ? 'Class Average' : `${subjectFilter} Avg`}
          </p>
          <p className={cn('font-heading text-2xl font-bold', gradeColor(classAvg))}>{classAvg}%</p>
        </CardContent></Card>
        <Card className="border-border"><CardContent className="p-4">
          <p className="text-xs text-muted-foreground">Highest</p>
          <p className="font-heading text-2xl font-bold text-success">
            {filtered.length > 0 ? Math.max(...filtered.map(g => g.displayAverage || 0)) : 0}%
          </p>
        </CardContent></Card>
        <Card className="border-border"><CardContent className="p-4">
          <p className="text-xs text-muted-foreground">Below Pass Mark</p>
          <p className="font-heading text-2xl font-bold text-destructive">{filtered.filter(g => (g.displayAverage || 0) < 50).length}</p>
        </CardContent></Card>
      </div>

      {/* Filters */}
      <Card className="border-border">
        <CardContent className="p-4">
          <div className="flex flex-wrap gap-3">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <Input placeholder="Search students..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
            </div>
            
            <Select value={classFilter} onValueChange={setClassFilter}>
              <SelectTrigger className="w-[140px]"><SelectValue placeholder="All Classes" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Classes</SelectItem>
                {classes.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
              </SelectContent>
            </Select>

            <Select value={subjectFilter} onValueChange={setSubjectFilter}>
              <SelectTrigger className="w-[160px]"><SelectValue placeholder="All Subjects" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Subjects</SelectItem>
                {allSubjects.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Grades Table */}
      <Card className="border-border overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-border bg-muted/50">
                <th className="text-left text-xs font-semibold text-muted-foreground px-4 py-3">Student</th>
                <th className="text-left text-xs font-semibold text-muted-foreground px-3 py-3">Class</th>
                <th className="text-center text-xs font-semibold text-muted-foreground px-3 py-3">Quizzes Taken</th>
                <th className="text-center text-xs font-semibold text-muted-foreground px-3 py-3">Avg Score</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={4} className="text-center py-12"><Loader2 className="w-8 h-8 animate-spin text-primary mx-auto" /></td></tr>
              ) : filtered.map(student => (
                <tr key={student.id} className="border-b border-border hover:bg-muted/30 transition-colors">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <div className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center text-primary font-semibold text-xs">
                        {(student.studentName || '?').charAt(0)}
                      </div>
                      <div>
                        <p className="text-sm font-medium text-foreground">{student.studentName}</p>
                        <p className="text-xs text-muted-foreground">{student.email}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-3 py-3 text-xs text-muted-foreground">{student.className}</td>
                  <td className="px-3 py-3 text-center text-sm text-foreground">{student.displayCount}</td>
                  <td className="px-3 py-3 text-center">
                    <span className={cn('text-sm font-bold', gradeColor(student.displayAverage))}>{student.displayAverage}%</span>
                  </td>
                </tr>
              ))}
              {!loading && filtered.length === 0 && (
                <tr><td colSpan={4} className="text-center py-8 text-muted-foreground text-sm">No grade data found matching your filters.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}

