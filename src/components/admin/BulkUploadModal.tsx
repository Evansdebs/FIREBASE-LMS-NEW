import { useState, useRef, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Upload, Download, FileSpreadsheet, Loader2, AlertCircle, CheckCircle2 } from 'lucide-react';
import { toast } from 'sonner';
import * as XLSX from 'xlsx';
import ExcelJS from 'exceljs';
import { getClasses, getCourses } from '@/lib/services/academicService';
import { createUser } from '@/lib/services/userService';

const ROLES = ['student', 'teacher', 'admin'];
const GENDERS = ['MALE', 'FEMALE', 'OTHER'];

export function BulkUploadModal({ onComplete }: { onComplete: () => void }) {
  const [open, setOpen] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [previewData, setPreviewData] = useState<any[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadResult, setUploadResult] = useState<{ successCount: number; failedRows: any[]; totalRows: number } | null>(null);
  const [classesList, setClassesList] = useState<string[]>([]);
  const [coursesList, setCoursesList] = useState<string[]>([]);

  useEffect(() => {
    getClasses().then(res => setClassesList(res.map(c => c.name))).catch(() => {});
    getCourses().then(res => setCoursesList(res.map(c => c.title))).catch(() => {});
  }, []);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const resetState = () => {
    setFile(null);
    setPreviewData([]);
    setUploadResult(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleOpenChange = (v: boolean) => {
    setOpen(v);
    if (!v) resetState();
  };

  const downloadTemplate = async () => {
    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'ONEREAL LMS';
    workbook.created = new Date();

    // ── Hidden sheet for dropdown source lists ──────────────────
    const listsSheet = workbook.addWorksheet('__Lists', { state: 'veryHidden' });
    classesList.forEach((cls, i) => {
      listsSheet.getCell(`A${i + 1}`).value = cls;
    });
    ROLES.forEach((role, i) => {
      listsSheet.getCell(`B${i + 1}`).value = role;
    });
    GENDERS.forEach((gender, i) => {
      listsSheet.getCell(`C${i + 1}`).value = gender;
    });
    coursesList.forEach((course, i) => {
      listsSheet.getCell(`D${i + 1}`).value = course;
    });

    // ── Main template sheet ────────────────────────────────────
    const ws = workbook.addWorksheet('Users');

    // Column definitions
    ws.columns = [
      { header: 'first_name', key: 'first_name', width: 18 },
      { header: 'last_name', key: 'last_name', width: 18 },
      { header: 'email', key: 'email', width: 28 },
      { header: 'phone', key: 'phone', width: 16 },
      { header: 'gender', key: 'gender', width: 12 },
      { header: 'role', key: 'role', width: 14 },
      { header: 'class', key: 'class', width: 16 },
      { header: 'course', key: 'course', width: 22 },
      { header: 'password', key: 'password', width: 18 },
    ];

    // Style the header row
    const headerRow = ws.getRow(1);
    headerRow.eachCell((cell) => {
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF4F46E5' } };
      cell.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 11 };
      cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
      cell.border = {
        bottom: { style: 'medium', color: { argb: 'FF3730A3' } },
      };
    });
    headerRow.height = 24;

    // Sample rows (rows 2 & 3)
    const sampleRows = [
      { first_name: 'Ama', last_name: 'Asante', email: 'ama@school.edu', phone: '0240000001', gender: 'FEMALE', role: 'student', class: classesList[0] || 'BASIC 1', course: '', password: '123456' },
      { first_name: 'Mr Kwame', last_name: 'Mensah', email: 'kwame@school.edu', phone: '0240000002', gender: 'MALE', role: 'teacher', class: classesList[0] || 'BASIC 1', course: coursesList[0] || 'Mathematics', password: 'teacher123' },
    ];
    sampleRows.forEach((row, i) => {
      const r = ws.addRow(row);
      r.eachCell((cell) => {
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: i % 2 === 0 ? 'FFEEF2FF' : 'FFFFFFFF' } };
        cell.border = { bottom: { style: 'thin', color: { argb: 'FFE2E8F0' } } };
        cell.alignment = { vertical: 'middle' };
      });
    });

    // Apply dropdown data validation for rows 2–500
    const classListFormula = `__Lists!$A$1:$A$${Math.max(1, classesList.length)}`;
    const roleListFormula = `__Lists!$B$1:$B$${ROLES.length}`;
    const genderListFormula = `__Lists!$C$1:$C$${GENDERS.length}`;
    const courseListFormula = `__Lists!$D$1:$D$${Math.max(1, coursesList.length)}`;

    for (let rowNum = 2; rowNum <= 500; rowNum++) {
      // Gender dropdown (column E = index 5)
      ws.getCell(`E${rowNum}`).dataValidation = {
        type: 'list',
        allowBlank: true,
        formulae: [genderListFormula],
        showErrorMessage: true,
        errorStyle: 'stop',
        errorTitle: 'Invalid Gender',
        error: 'Please select a valid gender from the list: MALE, FEMALE, OTHER',
      };

      // Role dropdown (column F = index 6)
      ws.getCell(`F${rowNum}`).dataValidation = {
        type: 'list',
        allowBlank: true,
        formulae: [roleListFormula],
        showErrorMessage: true,
        errorStyle: 'stop',
        errorTitle: 'Invalid Role',
        error: 'Please select a valid role from the list: student, teacher, admin',
      };

      // Class dropdown (column G = index 7)
      if (classesList.length > 0) {
        ws.getCell(`G${rowNum}`).dataValidation = {
          type: 'list',
          allowBlank: true,
          formulae: [classListFormula],
          showErrorMessage: true,
          errorStyle: 'warning',
          errorTitle: 'Check Class',
          error: `Please verify that the class matches your system records. You can comma-separate if assigning multiple.`,
        };
      }

      // Course dropdown (column H = index 8)
      if (coursesList.length > 0) {
        ws.getCell(`H${rowNum}`).dataValidation = {
          type: 'list',
          allowBlank: true,
          formulae: [courseListFormula],
          showErrorMessage: true,
          errorStyle: 'warning',
          errorTitle: 'Check Course',
          error: `Please verify that the course/subject matches your system records. You can comma-separate if assigning multiple.`,
        };
      }
    }

    // Freeze the header row
    ws.views = [{ state: 'frozen', ySplit: 1 }];

    // Add an instructions row note above the header (row 1 annotations)
    ws.getCell('H1').note = { // Now H1 since we added a column
      texts: [
        { font: { bold: true }, text: 'For Teachers Only:\n' },
        { text: 'Use comma-separated values for multiple classes/subjects.\nE.g.: "BASIC7, BASIC8" or "Maths, Science"' },
      ],
    };

    // Write to buffer and trigger download
    const buffer = await workbook.xlsx.writeBuffer();
    const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'ONEREAL_User_Upload_Template.xlsx';
    link.click();
    URL.revokeObjectURL(url);

    toast.success('Template downloaded! Fill it and upload.');
  };

  const processFile = (selectedFile: File) => {
    if (!selectedFile) return;
    setFile(selectedFile);

    const reader = new FileReader();
    reader.onload = (e) => {
      const data = new Uint8Array(e.target?.result as ArrayBuffer);
      const workbook = XLSX.read(data, { type: 'array' });
      // Skip hidden sheets like __Lists
      const sheetName = workbook.SheetNames.find(n => !n.startsWith('__')) || workbook.SheetNames[0];
      const worksheet = workbook.Sheets[sheetName];
      const json = XLSX.utils.sheet_to_json(worksheet);

      if (json.length === 0) {
        toast.error('The uploaded file is empty.');
        resetState();
        return;
      }
      setPreviewData(json);
    };
    reader.readAsArrayBuffer(selectedFile);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const droppedFile = e.dataTransfer.files[0];
    if (droppedFile && (droppedFile.name.endsWith('.xlsx') || droppedFile.name.endsWith('.csv'))) {
      processFile(droppedFile);
    } else {
      toast.error('Only .xlsx or .csv files are supported');
    }
  };

  const uploadUsers = async () => {
    if (previewData.length === 0) return;
    setIsUploading(true);
    let successCount = 0;
    const failedRows: any[] = [];

    try {
      for (const row of previewData) {
        try {
          const email = (row.email || '').trim().toLowerCase();
          const firstName = row.first_name || '';
          const lastName = row.last_name || '';
          const fullName = `${firstName} ${lastName}`.trim() || email;
          const role = (row.role || 'student').toUpperCase() === 'ADMIN' ? 'SUPER_ADMIN' : (row.role || 'student').toUpperCase();
          const password = String(row.password || '123456');

          if (!email) throw new Error('Email is required');

          await createUser({
            email,
            password,
            name: fullName,
            role: (role === 'TEACHER' ? 'TEACHER' : 'STUDENT') as any,
            className: row.class || undefined,
            gender: row.gender || undefined,
          });

          successCount++;
        } catch (err: any) {
          failedRows.push({ ...row, reason: err.message || 'Error creating user' });
        }
      }

      setUploadResult({ successCount, failedRows, totalRows: previewData.length });

      if (successCount > 0) {
        toast.success(`Successfully added ${successCount} users!`);
        onComplete();
      }
      if (failedRows.length > 0) {
        toast.error(`${failedRows.length} rows failed.`);
      }
    } catch (error: any) {
      toast.error(error?.message || 'Failed to upload users.');
    } finally {
      setIsUploading(false);
    }
  };

  const downloadErrorReport = async () => {
    if (!uploadResult || uploadResult.failedRows.length === 0) return;

    const workbook = new ExcelJS.Workbook();
    const ws = workbook.addWorksheet('Failed Rows');

    const headers = ['row', 'first_name', 'last_name', 'email', 'phone', 'gender', 'role', 'class', 'course', 'ERROR_REASON'];
    ws.addRow(headers);
    const headerRow = ws.getRow(1);
    headerRow.eachCell((cell) => {
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFEF4444' } };
      cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    });

    uploadResult.failedRows.forEach((r: any) => {
      const orig = previewData[r.row - 2] || {};
      ws.addRow([r.row, orig.first_name, orig.last_name, orig.email || r.email, orig.phone, orig.gender, orig.role, orig.class, orig.course, r.reason]);
    });

    ws.columns.forEach(col => { col.width = 22; });

    const buffer = await workbook.xlsx.writeBuffer();
    const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'Bulk_Upload_Errors.xlsx';
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button variant="outline" className="gap-2"><Upload className="w-4 h-4" /> Bulk Upload</Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[720px] max-h-[92vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-heading text-xl flex items-center gap-2">
            <FileSpreadsheet className="w-5 h-5 text-primary" /> Bulk Upload Users via Excel
          </DialogTitle>
        </DialogHeader>

        {!uploadResult ? (
          <div className="space-y-5 py-2">
            {/* Step 1 */}
            <div className="flex justify-between items-center bg-primary/5 border border-primary/20 p-4 rounded-xl">
              <div>
                <h4 className="text-sm font-semibold text-card-foreground">Step 1 — Download Template</h4>
                <p className="text-xs text-muted-foreground mt-1">
                  Pre-formatted with <span className="text-primary font-medium">dropdown validations</span> for Role and Class.
                </p>
              </div>
              <Button onClick={downloadTemplate} size="sm" variant="secondary" className="gap-2 shrink-0">
                <Download className="w-4 h-4" /> Get Template (.xlsx)
              </Button>
            </div>

            {/* Class quick-reference */}
            <div className="bg-muted/40 rounded-lg p-3 border border-border">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Valid Class Levels</p>
              <div className="flex flex-wrap gap-1.5">
                {classesList.map(cls => (
                  <span key={cls} className="text-xs bg-primary/10 text-primary rounded-full px-2 py-0.5 font-medium">{cls}</span>
                ))}
              </div>
              <p className="text-xs text-muted-foreground mt-2">Teachers can use comma-separated values, e.g. <span className="font-mono text-card-foreground">{classesList[0] || 'CLASS1'}, {classesList[1] || 'CLASS2'}</span></p>
            </div>

            {/* Step 2 */}
            <div className="space-y-2">
              <h4 className="text-sm font-semibold text-card-foreground">Step 2 — Upload Filled File</h4>
              <div
                className={`border-2 border-dashed rounded-xl p-10 text-center transition-all cursor-pointer ${file ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/50 hover:bg-muted/30'
                  }`}
                onDragOver={e => e.preventDefault()}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
              >
                <input
                  type="file"
                  ref={fileInputRef}
                  className="hidden"
                  accept=".xlsx,.csv"
                  onChange={(e) => { if (e.target.files?.[0]) processFile(e.target.files[0]); }}
                />
                <FileSpreadsheet className={`w-10 h-10 mx-auto mb-3 ${file ? 'text-primary' : 'text-muted-foreground'}`} />
                {file ? (
                  <p className="text-sm font-semibold text-primary">{file.name}</p>
                ) : (
                  <>
                    <p className="text-sm text-card-foreground font-medium">Drag & drop your Excel file here</p>
                    <p className="text-xs text-muted-foreground mt-1">or click to browse — accepts .xlsx or .csv</p>
                  </>
                )}
              </div>
            </div>

            {/* Preview */}
            {previewData.length > 0 && (
              <div className="border border-border rounded-xl overflow-hidden">
                <div className="bg-muted/50 px-4 py-2.5 border-b border-border flex items-center justify-between">
                  <h4 className="text-sm font-semibold text-card-foreground">Step 3 — Preview & Submit</h4>
                  <span className="text-xs text-muted-foreground">{previewData.length} records parsed</span>
                </div>
                <div className="max-h-[200px] overflow-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-muted sticky top-0 text-xs uppercase text-muted-foreground">
                      <tr>
                        <th className="px-3 py-2 text-left">#</th>
                        <th className="px-3 py-2 text-left">Name</th>
                        <th className="px-3 py-2 text-left">Email</th>
                        <th className="px-3 py-2 text-left">Gender</th>
                        <th className="px-3 py-2 text-left">Role</th>
                        <th className="px-3 py-2 text-left">Class</th>
                      </tr>
                    </thead>
                    <tbody>
                      {previewData.slice(0, 50).map((row, i) => (
                        <tr key={i} className={`border-b border-border/50 ${i % 2 === 0 ? 'bg-background' : 'bg-muted/20'}`}>
                          <td className="px-3 py-2 text-muted-foreground font-mono text-xs">{i + 2}</td>
                          <td className="px-3 py-2 font-medium">{row.first_name} {row.last_name}</td>
                          <td className="px-3 py-2 text-muted-foreground">{row.email}</td>
                          <td className="px-3 py-2 text-muted-foreground text-xs">{row.gender || '-'}</td>
                          <td className="px-3 py-2">
                            <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${row.role === 'teacher' ? 'bg-blue-500/10 text-blue-500' :
                                row.role === 'admin' ? 'bg-primary/10 text-primary' :
                                  'bg-green-500/10 text-green-600'
                              }`}>{row.role}</span>
                          </td>
                          <td className="px-3 py-2">{row.class}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {previewData.length > 50 && (
                    <p className="text-xs text-muted-foreground text-center py-2">Showing first 50 of {previewData.length} rows</p>
                  )}
                </div>
                <div className="p-4 bg-muted/30 border-t border-border">
                  <Button onClick={uploadUsers} className="w-full gap-2" disabled={isUploading}>
                    {isUploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
                    {isUploading ? 'Processing Upload...' : `Submit ${previewData.length} Users`}
                  </Button>
                </div>
              </div>
            )}
          </div>
        ) : (
          /* Result View */
          <div className="space-y-5 py-4">
            <div className="text-center space-y-3">
              <div className={`w-16 h-16 rounded-full mx-auto flex items-center justify-center ${uploadResult.failedRows.length === 0 ? 'bg-green-500/10 text-green-500' : 'bg-orange-500/10 text-orange-500'
                }`}>
                {uploadResult.failedRows.length === 0
                  ? <CheckCircle2 className="w-9 h-9" />
                  : <AlertCircle className="w-9 h-9" />}
              </div>
              <div>
                <h3 className="text-xl font-heading font-bold text-card-foreground">Upload Complete</h3>
                <p className="text-muted-foreground text-sm mt-1">{uploadResult.totalRows} total rows processed</p>
              </div>
              <div className="flex gap-4 justify-center">
                <div className="bg-green-500/10 rounded-lg px-5 py-3">
                  <p className="text-2xl font-bold text-green-500">{uploadResult.successCount}</p>
                  <p className="text-xs text-muted-foreground">Successful</p>
                </div>
                <div className="bg-destructive/10 rounded-lg px-5 py-3">
                  <p className="text-2xl font-bold text-destructive">{uploadResult.failedRows.length}</p>
                  <p className="text-xs text-muted-foreground">Failed</p>
                </div>
              </div>
            </div>

            {uploadResult.failedRows.length > 0 && (
              <div className="border border-destructive/20 bg-destructive/5 rounded-xl overflow-hidden">
                <div className="flex items-center gap-2 px-4 py-3 border-b border-destructive/20">
                  <AlertCircle className="w-4 h-4 text-destructive" />
                  <h4 className="text-sm font-semibold text-destructive">Failed Row Details</h4>
                </div>
                <div className="max-h-[180px] overflow-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-muted text-xs sticky top-0 text-muted-foreground">
                      <tr>
                        <th className="px-3 py-2 text-left">Row</th>
                        <th className="px-3 py-2 text-left">Email</th>
                        <th className="px-3 py-2 text-left">Reason</th>
                      </tr>
                    </thead>
                    <tbody>
                      {uploadResult.failedRows.map((r: any, idx) => (
                        <tr key={idx} className="border-b border-border/50">
                          <td className="px-3 py-2 font-mono text-xs text-muted-foreground">{r.row}</td>
                          <td className="px-3 py-2">{r.email || 'N/A'}</td>
                          <td className="px-3 py-2 text-destructive text-xs">{r.reason}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <div className="p-3 border-t border-destructive/20">
                  <Button onClick={downloadErrorReport} variant="destructive" className="w-full gap-2">
                    <Download className="w-4 h-4" /> Download Error Report (.xlsx)
                  </Button>
                </div>
              </div>
            )}

            <div className="flex gap-3">
              <Button variant="outline" onClick={resetState} className="flex-1">Upload Another File</Button>
              <Button variant="ghost" onClick={() => handleOpenChange(false)} className="flex-1">Close</Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
