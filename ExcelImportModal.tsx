import React, { useState, useRef } from 'react';
import * as XLSX from 'xlsx';
import { DayOfWeek, MenuItem, DAYS_OF_WEEK } from '../types/database';
import { formatVND, DAY_NAMES } from '../utils/formatters';
import {
  FileSpreadsheet,
  Download,
  Upload,
  AlertTriangle,
  CheckCircle2,
  X,
  FileText,
  Loader2,
} from 'lucide-react';

interface ParsedItem {
  day: DayOfWeek;
  name: string;
  price: number;
  isDefaultPrice: boolean;
  rowNumber: number;
}

interface InvalidRow {
  rowNumber: number;
  rawDay: string;
  rawName: string;
  reason: string;
}

interface ExcelImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  weeklyMenuId: string;
  addMenuItem: (item: {
    weekly_menu_id: string;
    day_of_week: DayOfWeek;
    name: string;
    price: number;
  }) => Promise<MenuItem | null>;
  showToast: (msg: string, type?: 'success' | 'error' | 'info') => void;
}

export const ExcelImportModal: React.FC<ExcelImportModalProps> = ({
  isOpen,
  onClose,
  weeklyMenuId,
  addMenuItem,
  showToast,
}) => {
  const [fileName, setFileName] = useState<string>('');
  const [validItems, setValidItems] = useState<ParsedItem[]>([]);
  const [invalidRows, setInvalidRows] = useState<InvalidRow[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [importProgress, setImportProgress] = useState({ current: 0, total: 0 });
  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  // 1. Tải file Excel mẫu
  const handleDownloadSample = () => {
    try {
      const sampleRows = [
        { 'Thứ': 'Thứ 2', 'Tên món': 'Cơm sườn nướng mật ong', 'Giá': 36000 },
        { 'Thứ': 'Thứ 2', 'Tên món': 'Cơm cá hồi sốt teriyaki', 'Giá': 40000 },
        { 'Thứ': 'Thứ 3', 'Tên món': 'Cơm gà xối mỡ giòn da', 'Giá': 36000 },
        { 'Thứ': 'Thứ 3', 'Tên món': 'Cơm bò xào lúc lắc', 'Giá': '' }, // Để trống để test giá mặc định 36.000
        { 'Thứ': 'Thứ 4', 'Tên món': 'Cơm thịt kho tàu trứng cút', 'Giá': 36000 },
        { 'Thứ': 'Thứ 4', 'Tên món': 'Cơm sườn non ram mặn', 'Giá': '' },
        { 'Thứ': 'Thứ 5', 'Tên món': 'Cơm đùi gà chiên nước mắm', 'Giá': 36000 },
        { 'Thứ': 'Thứ 5', 'Tên món': 'Cơm cá thu sốt cà', 'Giá': 38000 },
        { 'Thứ': 'Thứ 6', 'Tên món': 'Cơm mực xào sa tế', 'Giá': 36000 },
        { 'Thứ': 'Thứ 6', 'Tên món': 'Cơm ba chỉ rim tôm', 'Giá': '' },
      ];

      const ws = XLSX.utils.json_to_sheet(sampleRows, {
        header: ['Thứ', 'Tên món', 'Giá'],
      });

      // Độ rộng cột
      ws['!cols'] = [{ wch: 15 }, { wch: 35 }, { wch: 18 }];

      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Thực đơn tuần');

      XLSX.writeFile(wb, 'thuc_don_tuan_mau.xlsx');
      showToast('Đã tải file Excel mẫu thành công!', 'success');
    } catch (err: any) {
      console.error('Lỗi tạo file mẫu:', err);
      showToast('Không thể tạo file mẫu: ' + (err.message || ''), 'error');
    }
  };

  // Map giá trị cột Thứ sang DayOfWeek
  const mapDayOfWeek = (raw: any): DayOfWeek | null => {
    if (!raw) return null;
    const str = String(raw).trim().toLowerCase();

    // Thứ 2
    if (
      str === 'thứ 2' ||
      str === 'thu 2' ||
      str === 't2' ||
      str === '2' ||
      str === 'thứ hai' ||
      str === 'thu hai' ||
      str === 'monday' ||
      str === 'mon'
    ) {
      return 'monday';
    }
    // Thứ 3
    if (
      str === 'thứ 3' ||
      str === 'thu 3' ||
      str === 't3' ||
      str === '3' ||
      str === 'thứ ba' ||
      str === 'thu ba' ||
      str === 'tuesday' ||
      str === 'tue'
    ) {
      return 'tuesday';
    }
    // Thứ 4
    if (
      str === 'thứ 4' ||
      str === 'thu 4' ||
      str === 't4' ||
      str === '4' ||
      str === 'thứ tư' ||
      str === 'thu tu' ||
      str === 'thứ 4' ||
      str === 'wednesday' ||
      str === 'wed'
    ) {
      return 'wednesday';
    }
    // Thứ 5
    if (
      str === 'thứ 5' ||
      str === 'thu 5' ||
      str === 't5' ||
      str === '5' ||
      str === 'thứ năm' ||
      str === 'thu nam' ||
      str === 'thursday' ||
      str === 'thu'
    ) {
      return 'thursday';
    }
    // Thứ 6
    if (
      str === 'thứ 6' ||
      str === 'thu 6' ||
      str === 't6' ||
      str === '6' ||
      str === 'thứ sáu' ||
      str === 'thu sau' ||
      str === 'friday' ||
      str === 'fri'
    ) {
      return 'friday';
    }

    return null;
  };

  // 2. Đọc file Excel từ máy người dùng
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setFileName(file.name);
    setIsProcessing(true);

    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const buffer = evt.target?.result;
        const workbook = XLSX.read(buffer, { type: 'binary' });

        if (!workbook.SheetNames || workbook.SheetNames.length === 0) {
          throw new Error('File Excel không có sheet nào.');
        }

        const sheetName = workbook.SheetNames[0];
        const sheet = workbook.Sheets[sheetName];
        const rawJson: any[] = XLSX.utils.sheet_to_json(sheet, { defval: '' });

        if (!rawJson || rawJson.length === 0) {
          showToast('File Excel không có dữ liệu nào.', 'error');
          setValidItems([]);
          setInvalidRows([]);
          setIsProcessing(false);
          return;
        }

        const parsedValid: ParsedItem[] = [];
        const parsedInvalid: InvalidRow[] = [];

        rawJson.forEach((row, index) => {
          const rowNumber = index + 2; // Dòng 1 thường là header

          // Tìm tên cột linh hoạt (không phân biệt hoa thường hoặc dấu)
          let rawDay = '';
          let rawName = '';
          let rawPrice: any = '';

          for (const key of Object.keys(row)) {
            const cleanKey = key.trim().toLowerCase();
            if (cleanKey.includes('thứ') || cleanKey.includes('thu') || cleanKey === 'day' || cleanKey === 'ngày' || cleanKey === 'ngay') {
              rawDay = row[key];
            } else if (cleanKey.includes('tên') || cleanKey.includes('ten') || cleanKey.includes('món') || cleanKey.includes('mon') || cleanKey === 'dish') {
              rawName = row[key];
            } else if (cleanKey.includes('giá') || cleanKey.includes('gia') || cleanKey.includes('price') || cleanKey.includes('tiền')) {
              rawPrice = row[key];
            }
          }

          // Fallback nếu không khớp tên header
          if (!rawDay && row['Thứ'] !== undefined) rawDay = row['Thứ'];
          if (!rawName && row['Tên món'] !== undefined) rawName = row['Tên món'];
          if (rawPrice === '' && row['Giá'] !== undefined) rawPrice = row['Giá'];

          const trimmedName = String(rawName || '').trim();

          // Bỏ qua dòng trống hoàn toàn
          if (!rawDay && !trimmedName && (rawPrice === '' || rawPrice === undefined)) {
            return;
          }

          // Kiểm tra tên món
          if (!trimmedName) {
            parsedInvalid.push({
              rowNumber,
              rawDay: String(rawDay || ''),
              rawName: '(Trống)',
              reason: 'Tên món ăn không được để trống.',
            });
            return;
          }

          // Kiểm tra thứ
          const mappedDay = mapDayOfWeek(rawDay);
          if (!mappedDay) {
            parsedInvalid.push({
              rowNumber,
              rawDay: String(rawDay || '(Trống)'),
              rawName: trimmedName,
              reason: `Thứ "${rawDay || 'Trống'}" không hợp lệ. Chỉ chấp nhận Thứ 2 đến Thứ 6.`,
            });
            return;
          }

          // Xử lý giá tiền: nếu để trống hoặc không phải số hợp lệ, dùng giá mặc định 36.000
          let price = 36000;
          let isDefaultPrice = false;

          if (rawPrice === undefined || rawPrice === null || String(rawPrice).trim() === '') {
            price = 36000;
            isDefaultPrice = true;
          } else {
            const cleanPrice = String(rawPrice).replace(/[^\d]/g, '');
            const parsedNum = parseInt(cleanPrice, 10);
            if (!isNaN(parsedNum) && parsedNum > 0) {
              price = parsedNum;
            } else {
              price = 36000;
              isDefaultPrice = true;
            }
          }

          parsedValid.push({
            day: mappedDay,
            name: trimmedName,
            price,
            isDefaultPrice,
            rowNumber,
          });
        });

        setValidItems(parsedValid);
        setInvalidRows(parsedInvalid);

        if (parsedValid.length === 0 && parsedInvalid.length > 0) {
          showToast('Không tìm thấy dòng món ăn hợp lệ nào trong file.', 'error');
        } else {
          showToast(
            `Đã đọc ${parsedValid.length} món hợp lệ${
              parsedInvalid.length > 0 ? ` (bỏ qua ${parsedInvalid.length} dòng lỗi)` : ''
            }`,
            'info'
          );
        }
      } catch (err: any) {
        console.error('Lỗi phân tích file Excel:', err);
        showToast('Lỗi đọc file Excel: ' + (err.message || 'File không đúng định dạng'), 'error');
      } finally {
        setIsProcessing(false);
      }
    };

    reader.onerror = () => {
      showToast('Không thể đọc file đã chọn.', 'error');
      setIsProcessing(false);
    };

    reader.readAsBinaryString(file);
  };

  // 3. Xác nhận nhập danh sách món ăn vào thực đơn
  const handleConfirmImport = async () => {
    if (validItems.length === 0) return;
    setIsImporting(true);
    setImportProgress({ current: 0, total: validItems.length });

    let successCount = 0;

    try {
      for (let i = 0; i < validItems.length; i++) {
        const item = validItems[i];
        setImportProgress({ current: i + 1, total: validItems.length });

        const created = await addMenuItem({
          weekly_menu_id: weeklyMenuId,
          day_of_week: item.day,
          name: item.name,
          price: item.price,
        });

        if (created) {
          successCount++;
        }
      }

      showToast(
        `Đã nhập thành công ${successCount}/${validItems.length} món ăn vào thực đơn tuần!`,
        'success'
      );
      handleClose();
    } catch (err: any) {
      console.error('Lỗi khi nhập món:', err);
      showToast(`Đã nhập được ${successCount} món thì gặp sự cố: ` + err.message, 'error');
    } finally {
      setIsImporting(false);
    }
  };

  const handleClose = () => {
    setFileName('');
    setValidItems([]);
    setInvalidRows([]);
    setIsProcessing(false);
    setIsImporting(false);
    if (fileInputRef.current) fileInputRef.current.value = '';
    onClose();
  };

  // Gom nhóm các món hợp lệ theo từng ngày
  const groupedItems = DAYS_OF_WEEK.map((day) => ({
    day,
    dayName: DAY_NAMES[day],
    items: validItems.filter((i) => i.day === day),
  }));

  return (
    <div className="fixed inset-0 z-50 bg-stone-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
      <div className="bg-white rounded-3xl max-w-2xl w-full p-5 sm:p-6 shadow-2xl border border-stone-200 animate-in fade-in zoom-in-95 duration-150 my-8 max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-stone-100 shrink-0">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-purple-50 text-purple-700 flex items-center justify-center">
              <FileSpreadsheet className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-bold text-base text-stone-900">
                Nhập thực đơn từ file Excel
              </h3>
              <p className="text-xs text-stone-500 font-medium">
                Tải lên danh sách món ăn từ Thứ 2 đến Thứ 6
              </p>
            </div>
          </div>
          <button
            onClick={handleClose}
            disabled={isImporting}
            className="w-7 h-7 rounded-full bg-stone-100 text-stone-500 hover:bg-stone-200 flex items-center justify-center font-bold text-sm disabled:opacity-50"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Action Bar: Download Sample + Upload Input */}
        <div className="py-4 space-y-3 shrink-0">
          <div className="flex flex-wrap items-center justify-between gap-2 bg-stone-50 p-3 rounded-2xl border border-stone-200">
            <div className="flex items-center gap-2 text-xs text-stone-700 font-medium">
              <FileText className="w-4 h-4 text-purple-600 shrink-0" />
              <span>Cần file mẫu chuẩn cột "Thứ", "Tên món", "Giá"?</span>
            </div>
            <button
              type="button"
              onClick={handleDownloadSample}
              id="btn-download-excel-sample"
              className="px-3 py-1.5 rounded-xl bg-white border border-stone-200 hover:bg-purple-50 hover:border-purple-200 text-purple-700 text-xs font-bold transition-colors flex items-center gap-1.5 shadow-2xs"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Tải file mẫu (.xlsx)</span>
            </button>
          </div>

          {/* Upload Drop/Select Area */}
          <div className="flex flex-col sm:flex-row items-center gap-3">
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileChange}
              accept=".xlsx, .xls"
              className="hidden"
              id="excel-file-input"
            />
            <label
              htmlFor="excel-file-input"
              className="flex-1 w-full py-3 px-4 rounded-2xl border-2 border-dashed border-purple-300 hover:border-purple-500 bg-purple-50/40 hover:bg-purple-50 cursor-pointer transition-colors flex items-center justify-center gap-2 text-xs font-bold text-purple-800"
            >
              <Upload className="w-4 h-4 text-purple-600" />
              <span>{fileName ? `Đã chọn: ${fileName}` : 'Chọn file Excel từ máy tính (.xlsx, .xls)'}</span>
            </label>
          </div>
        </div>

        {/* Scrollable Content Area: Preview & Validation Warnings */}
        <div className="flex-1 overflow-y-auto space-y-4 pr-1">
          {isProcessing && (
            <div className="py-12 text-center text-stone-500">
              <Loader2 className="w-6 h-6 animate-spin mx-auto text-purple-600 mb-2" />
              <p className="text-xs font-bold">Đang đọc và xử lý dữ liệu từ file Excel...</p>
            </div>
          )}

          {!isProcessing && validItems.length === 0 && invalidRows.length === 0 && (
            <div className="py-10 text-center text-stone-400 border border-dashed border-stone-200 rounded-2xl">
              <FileSpreadsheet className="w-10 h-10 mx-auto text-stone-300 mb-2" />
              <p className="text-xs font-bold text-stone-600">Chưa có dữ liệu để hiển thị</p>
              <p className="text-[11px] text-stone-400 mt-1 max-w-sm mx-auto">
                Hãy bấm "Tải file mẫu" để xem cấu trúc, hoặc chọn file Excel của bạn để xem trước các món ăn sẽ nhập.
              </p>
            </div>
          )}

          {/* Invalid Rows Alert (if any) */}
          {invalidRows.length > 0 && (
            <div className="p-3.5 rounded-2xl bg-amber-50 border border-amber-200 text-amber-900 text-xs">
              <div className="flex items-center gap-2 font-bold text-amber-800 mb-1.5">
                <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                <span>
                  Phát hiện {invalidRows.length} dòng không hợp lệ (hệ thống sẽ tự động bỏ qua các dòng này):
                </span>
              </div>
              <div className="max-h-32 overflow-y-auto space-y-1 pl-6 list-disc">
                {invalidRows.map((inv, idx) => (
                  <div key={idx} className="text-[11px] text-amber-700">
                    • <strong>Dòng {inv.rowNumber}:</strong> {inv.reason} (Tên món: "{inv.rawName}")
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Preview: Grouped by Day */}
          {validItems.length > 0 && (
            <div className="space-y-3">
              <div className="flex items-center justify-between px-1">
                <span className="text-xs font-bold text-stone-700 uppercase tracking-wider">
                  Xem trước món ăn hợp lệ ({validItems.length} món)
                </span>
                <span className="text-[11px] text-stone-500 font-medium">
                  {validItems.filter((i) => i.isDefaultPrice).length > 0 && (
                    <span className="text-purple-600 font-bold">
                      *Có {validItems.filter((i) => i.isDefaultPrice).length} món áp dụng giá mặc định 36.000đ
                    </span>
                  )}
                </span>
              </div>

              <div className="space-y-3">
                {groupedItems.map((group) => {
                  if (group.items.length === 0) return null;
                  return (
                    <div
                      key={group.day}
                      className="bg-stone-50 rounded-2xl border border-stone-200 p-3"
                    >
                      <div className="flex items-center justify-between pb-2 border-b border-stone-200 mb-2">
                        <span className="text-xs font-black text-purple-900">
                          {group.dayName}
                        </span>
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-purple-100 text-purple-700 border border-purple-200">
                          {group.items.length} món
                        </span>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        {group.items.map((item, idx) => (
                          <div
                            key={idx}
                            className="bg-white p-2.5 rounded-xl border border-stone-200 flex items-center justify-between gap-2 shadow-2xs"
                          >
                            <span className="text-xs font-bold text-stone-900 truncate">
                              {item.name}
                            </span>
                            <div className="flex items-center gap-1.5 shrink-0">
                              <span className="text-xs font-black text-purple-700">
                                {formatVND(item.price)}
                              </span>
                              {item.isDefaultPrice && (
                                <span className="text-[9px] font-bold bg-amber-100 text-amber-800 border border-amber-200 px-1 py-0.5 rounded">
                                  Mặc định
                                </span>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="mt-4 pt-3 border-t border-stone-100 flex items-center justify-between gap-3 shrink-0">
          <button
            type="button"
            onClick={handleClose}
            disabled={isImporting}
            className="px-4 py-2.5 rounded-xl border border-stone-200 text-stone-700 font-bold text-xs hover:bg-stone-50 transition-colors disabled:opacity-50"
          >
            Hủy
          </button>

          <button
            type="button"
            onClick={handleConfirmImport}
            disabled={isImporting || validItems.length === 0}
            id="btn-confirm-excel-import"
            className="px-5 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-700 text-white font-bold text-xs transition-colors shadow-xs flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isImporting ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>
                  Đang nhập ({importProgress.current}/{importProgress.total})...
                </span>
              </>
            ) : (
              <>
                <CheckCircle2 className="w-4 h-4" />
                <span>
                  Xác nhận nhập {validItems.length > 0 ? `(${validItems.length} món)` : ''}
                </span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
