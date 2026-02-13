import './App.css';
import { useState, useEffect, useCallback, useMemo } from 'react';
import AnnotationCanvas from './components/AnnotationCanvas';
import Toolbar from './components/Toolbar';
import PointList from './components/PointList';
import TaskNavigator from './components/TaskNavigator';
import { TaskData, LabelPoint } from './types';
import mockData from './mock/data.json';
import {
  watchRowAllFields,
  getTableRecordIds,
  getRowAllFields,
  writeDataToField,
  RowData,
  FieldData,
} from './utils/get_structured_data';

// ==================== Configuration ====================
const USE_MOCK = false; // 设为 false 以使用飞书多维表格数据
const INPUT_JSON_FIELD = '输入json';
const OUTPUT_JSON_FIELD = '输出json';
const STATUS_FIELD = '标注状态';

// ==================== Helpers ====================

/** Parse JSON from Lark text/url cell segments */
function parseLarkJsonField(value: any): TaskData | null {
  if (!value) return null;
  try {
    let raw = '';
    for (const item of value) {
      if (item.type === 'text' || item.type === 'url') {
        raw += item.text || '';
      }
    }
    console.log('raw:', raw);
    return JSON.parse(raw) as TaskData;
  } catch (e) {
    console.error('解析JSON字段出错:', e);
    return null;
  }
}

/** Extract TaskData from a row's fields (prefer output, fallback to input) */
function extractTaskFromFields(fields: FieldData[]): TaskData | null {

  const outputField = fields.find((f) => f.fieldName === OUTPUT_JSON_FIELD);
  const inputField = fields.find((f) => f.fieldName === INPUT_JSON_FIELD);
  console.log('outputField:', outputField);
  console.log('inputField:', inputField);
  let task = null;
  if (outputField?.value) {
    task = parseLarkJsonField(outputField.value);
  }
  if (!task && inputField?.value) {
    task = parseLarkJsonField(inputField.value);
  }
  console.log('task:', task);
  return task;
}

export default function App() {
  // Annotation state
  const [currentTask, setCurrentTask] = useState<TaskData | null>(null);
  const [selectedPointId, setSelectedPointId] = useState<number | null>(null);
  const [history, setHistory] = useState<LabelPoint[][]>([]);
  const [scale, setScale] = useState(1);
  const [isDirty, setIsDirty] = useState(false);

  // Lark Base state
  const [recordIds, setRecordIds] = useState<string[]>([]);
  const [currentRecordIndex, setCurrentRecordIndex] = useState<number>(-1);
  const [currentTableId, setCurrentTableId] = useState<string>('');
  const [allFieldsData, setAllFieldsData] = useState<FieldData[]>([]);

  // Mock state
  const [mockTasks] = useState<TaskData[]>(mockData as TaskData[]);
  const [mockIndex, setMockIndex] = useState(0);

  const points = currentTask?.label_info || [];
  const totalTasks = USE_MOCK ? mockTasks.length : recordIds.length;
  const currentIndex = USE_MOCK ? mockIndex : currentRecordIndex;

  // ==================== Mock mode init ====================
  useEffect(() => {
    if (USE_MOCK && mockTasks.length > 0) {
      setCurrentTask(mockTasks[0]);
    }
  }, []);

  // ==================== Lark Base helpers ====================

  /** Fetch all record IDs for a table, sorted by 任务ID */
  const fetchSortedRecordIds = useCallback(async (tableId: string) => {
    const { bitable } = await import('@lark-base-open/js-sdk');
    const table = await bitable.base.getTableById(tableId);
    const allIds = await table.getRecordIdList();
    const fieldMetaList = await table.getFieldMetaList();
    const taskIdField = fieldMetaList.find((f) => f.name === '任务ID');

    if (!taskIdField) return allIds;

    const items: { recordId: string; taskId: any }[] = [];
    for (const rid of allIds) {
      try {
        const val = await table.getCellValue(taskIdField.id, rid);
        items.push({ recordId: rid, taskId: val });
      } catch {
        items.push({ recordId: rid, taskId: null });
      }
    }
    items.sort((a, b) => {
      const va = a.taskId?.[0]?.text ?? a.taskId ?? '';
      const vb = b.taskId?.[0]?.text ?? b.taskId ?? '';
      const na = Number(va);
      const nb = Number(vb);
      if (!isNaN(na) && !isNaN(nb)) return na - nb;
      return String(va).localeCompare(String(vb));
    });
    return items.map((item) => item.recordId);
  }, []);

  /** Find the first record index where OUTPUT_JSON_FIELD is empty */
  const findFirstUnannotatedIndex = useCallback(async (tableId: string, sortedIds: string[]) => {
    const { bitable } = await import('@lark-base-open/js-sdk');
    const table = await bitable.base.getTableById(tableId);
    const fieldMetaList = await table.getFieldMetaList();
    const outputField = fieldMetaList.find((f) => f.name === OUTPUT_JSON_FIELD);

    if (!outputField) return 0; // fallback to first record

    for (let i = 0; i < sortedIds.length; i++) {
      try {
        const val = await table.getCellValue(outputField.id, sortedIds[i]);
        if (!val || (Array.isArray(val) && val.length === 0)) {
          return i; // found first unannotated
        }
      } catch {
        return i;
      }
    }
    return 0; // all annotated → start from first
  }, []);

  // ==================== Lark Base: auto-load on init ====================
  useEffect(() => {
    if (USE_MOCK) return;

    const initLoad = async () => {
      try {
        const { bitable } = await import('@lark-base-open/js-sdk');
        const selection = await bitable.base.getSelection();
        const tableId = selection?.tableId;
        if (!tableId) {
          console.log('未找到表格，等待用户选择...');
          return;
        }

        setCurrentTableId(tableId);
        console.log('初始化表格:', tableId);

        // Fetch sorted record IDs
        const sortedIds = await fetchSortedRecordIds(tableId);
        setRecordIds(sortedIds);
        console.log('记录总数(已按任务ID排序):', sortedIds.length);

        if (sortedIds.length === 0) return;

        // Find first unannotated record
        const startIndex = await findFirstUnannotatedIndex(tableId, sortedIds);
        console.log('首个未标注记录索引:', startIndex + 1, '/', sortedIds.length);

        // Load that record
        const rowData = await getRowAllFields({
          tableId,
          recordId: sortedIds[startIndex],
          useCurrentSelection: false,
        });

        if (rowData.success && rowData.data) {
          setCurrentRecordIndex(startIndex);
          setAllFieldsData(rowData.data);
          console.log('rowData.data:', rowData.data);
          const task = extractTaskFromFields(rowData.data);
          if (task) {
            setCurrentTask(task);
            console.log('自动加载任务:', task.image_name || task.task_id);
            // Mark as 标注中 when opened
            writeDataToField('标注中', {
              fieldName: STATUS_FIELD,
              useCurrentSelection: false,
              tableId,
              recordId: sortedIds[startIndex],
            });

          }
        }
      } catch (error) {
        console.error('初始化加载出错:', error);
      }
    };

    initLoad();
  }, []);

  // ==================== Lark Base: watch manual selection ====================
  useEffect(() => {
    if (USE_MOCK) return;

    const unwatchRowFields = watchRowAllFields(async (rowData: RowData) => {
      if (!rowData.success) {
        console.log('获取失败:', rowData.error);
        return;
      }

      console.log('用户选中记录:', rowData);

      // Determine the effective record list for index lookup
      let effectiveIds = recordIds;

      // If table changed, do a full re-initialization for the new table
      if (rowData.tableId && rowData.tableId !== currentTableId) {
        console.log('检测到表格切换:', currentTableId, '->', rowData.tableId);
        setCurrentTableId(rowData.tableId);

        const sortedIds = await fetchSortedRecordIds(rowData.tableId);
        setRecordIds(sortedIds);
        effectiveIds = sortedIds;
        console.log('新表格记录总数(已按任务ID排序):', sortedIds.length);

        if (sortedIds.length === 0) {
          setCurrentTask(null);
          setAllFieldsData([]);
          setCurrentRecordIndex(-1);
          return;
        }

        // Find first unannotated record in the new table
        const startIndex = await findFirstUnannotatedIndex(rowData.tableId, sortedIds);
        console.log('新表格首个未标注记录索引:', startIndex + 1, '/', sortedIds.length);

        // Load that record
        const newRowData = await getRowAllFields({
          tableId: rowData.tableId,
          recordId: sortedIds[startIndex],
          useCurrentSelection: false,
        });

        if (newRowData.success && newRowData.data) {
          setCurrentRecordIndex(startIndex);
          setAllFieldsData(newRowData.data);
          const task = extractTaskFromFields(newRowData.data);
          if (task) {
            setCurrentTask(task);
            setSelectedPointId(null);
            setHistory([]);
            setIsDirty(false);
            console.log('切换表格后自动加载任务:', task.image_name || task.task_id);
            writeDataToField('标注中', {
              fieldName: STATUS_FIELD,
              useCurrentSelection: false,
              tableId: rowData.tableId,
              recordId: sortedIds[startIndex],
            });
          }
        }
        return; // table switch handled, skip normal selection logic
      }

      // Update current record index using effectiveIds
      if (rowData.recordId && effectiveIds.length > 0) {
        const index = effectiveIds.indexOf(rowData.recordId);
        setCurrentRecordIndex(index);
        console.log('当前记录索引:', index + 1, '/', effectiveIds.length);
      }

      if (rowData.data && rowData.data.length > 0) {
        setAllFieldsData(rowData.data);
        const task = extractTaskFromFields(rowData.data);
        if (task) {
          setCurrentTask(task);
          setSelectedPointId(null);
          setHistory([]);
          setIsDirty(false);
        }
      } else {
        setAllFieldsData([]);
        setCurrentTask(null);
      }
    });

    return () => {
      unwatchRowFields();
    };
  }, [currentTableId, recordIds, fetchSortedRecordIds, findFirstUnannotatedIndex]);

  // ==================== Scale tracking ====================
  useEffect(() => {
    const interval = setInterval(() => {
      const canvasApi = (window as any).__annotationCanvas;
      if (canvasApi) {
        setScale(canvasApi.getScale());
      }
    }, 200);
    return () => clearInterval(interval);
  }, []);

  // ==================== Point CRUD ====================

  const nextId = useMemo(() => {
    if (points.length === 0) return 1;
    return Math.max(...points.map((p) => p.id)) + 1;
  }, [points]);

  const updateTask = useCallback(
    (updater: (task: TaskData) => TaskData) => {
      setCurrentTask((prev) => (prev ? updater(prev) : prev));
    },
    []
  );

  const pushHistory = useCallback(() => {
    setHistory((prev) => [...prev.slice(-30), [...points]]);
  }, [points]);

  const handleAddPoint = useCallback(
    (x: number, y: number) => {
      pushHistory();
      updateTask((task) => ({
        ...task,
        label_info: [...task.label_info, { id: nextId, x, y, label: '' }],
      }));
      setIsDirty(true);
    },
    [pushHistory, updateTask, nextId]
  );

  const handleDeletePoint = useCallback(
    (id: number) => {
      pushHistory();
      updateTask((task) => ({
        ...task,
        label_info: task.label_info.filter((p) => p.id !== id),
      }));
      if (selectedPointId === id) setSelectedPointId(null);
      setIsDirty(true);
    },
    [pushHistory, updateTask, selectedPointId]
  );

  const handleUpdateLabel = useCallback(
    (id: number, label: string) => {
      pushHistory();
      updateTask((task) => ({
        ...task,
        label_info: task.label_info.map((p) => (p.id === id ? { ...p, label } : p)),
      }));
      setIsDirty(true);
    },
    [pushHistory, updateTask]
  );

  const handleMovePoint = useCallback(
    (id: number, x: number, y: number) => {
      pushHistory();
      updateTask((task) => ({
        ...task,
        label_info: task.label_info.map((p) => (p.id === id ? { ...p, x, y } : p)),
      }));
      setIsDirty(true);
    },
    [pushHistory, updateTask]
  );

  const handleUndo = useCallback(() => {
    if (history.length === 0) return;
    const prev = history[history.length - 1];
    setHistory((h) => h.slice(0, -1));
    updateTask((task) => ({ ...task, label_info: prev }));
  }, [history, updateTask]);

  const handleClear = useCallback(() => {
    if (points.length === 0) return;
    pushHistory();
    updateTask((task) => ({ ...task, label_info: [] }));
    setSelectedPointId(null);
  }, [points.length, pushHistory, updateTask]);

  // ==================== Zoom ====================

  const handleFit = useCallback(() => {
    (window as any).__annotationCanvas?.fitToScreen();
  }, []);

  const handleZoomIn = useCallback(() => {
    (window as any).__annotationCanvas?.setScale(scale * 1.25);
  }, [scale]);

  const handleZoomOut = useCallback(() => {
    (window as any).__annotationCanvas?.setScale(scale / 1.25);
  }, [scale]);

  // ==================== Save to Lark Base ====================

  const saveToLarkBase = useCallback(
    async (task: TaskData, recordId: string, statusText?: string) => {
      if (USE_MOCK || !currentTableId || !recordId) return;

      console.log('保存到记录:', recordId);

      // Write annotation JSON
      await writeDataToField(JSON.stringify(task, null, 4), {
        fieldName: OUTPUT_JSON_FIELD,
        useCurrentSelection: false,
        tableId: currentTableId,
        recordId,
      });

      // Write status if provided
      if (statusText) {
        await writeDataToField(statusText, {
          fieldName: STATUS_FIELD,
          useCurrentSelection: false,
          tableId: currentTableId,
          recordId,
        });
      }
    },
    [currentTableId]
  );

  // ==================== Navigation ====================

  const loadRowByIndex = useCallback(
    async (index: number) => {
      if (USE_MOCK) {
        setMockIndex(index);
        setCurrentTask(mockTasks[index]);
        setSelectedPointId(null);
        setHistory([]);
        return;
      }

      if (!currentTableId || !recordIds[index]) return;
      try {
        const rowData = await getRowAllFields({
          tableId: currentTableId,
          recordId: recordIds[index],
          useCurrentSelection: false,
        });
        if (rowData.success && rowData.data) {
          setCurrentRecordIndex(index);
          setAllFieldsData(rowData.data);
          const task = extractTaskFromFields(rowData.data);
          if (task) {
            setCurrentTask(task);
            setSelectedPointId(null);
            setHistory([]);
            setIsDirty(false);
            // Mark as 标注中 when opened (only if not already done)
            if (task.status !== 'done' && currentTableId && recordIds[index]) {
              writeDataToField('标注中', {
                fieldName: STATUS_FIELD,
                useCurrentSelection: false,
                tableId: currentTableId,
                recordId: recordIds[index],
              });
            }
          }
          console.log('切换到行:', index + 1, '/', recordIds.length);
        }
      } catch (error) {
        console.error('切换行出错:', error);
      }
    },
    [currentTableId, recordIds, mockTasks]
  );

  const handlePrev = useCallback(async () => {
    if (currentIndex > 0) {
      // Auto-save current before switching (Lark mode), use explicit record ID
      if (!USE_MOCK && currentTask && recordIds[currentIndex]) {
        await saveToLarkBase(currentTask, recordIds[currentIndex], '标注中');
      }
      await loadRowByIndex(currentIndex - 1);
    }
  }, [currentIndex, currentTask, recordIds, saveToLarkBase, loadRowByIndex]);

  const handleNext = useCallback(async () => {
    if (currentIndex < totalTasks - 1) {
      // Auto-save current before switching (Lark mode), use explicit record ID
      if (!USE_MOCK && currentTask && recordIds[currentIndex]) {
        await saveToLarkBase(currentTask, recordIds[currentIndex], '标注中');
      }
      await loadRowByIndex(currentIndex + 1);
    }
  }, [currentIndex, totalTasks, currentTask, recordIds, saveToLarkBase, loadRowByIndex]);

  // ==================== Mark Done ====================

  const handleMarkDone = useCallback(() => {
    if (!currentTask) return;

    if (isDirty && currentTask.status === 'done') {
      // Already done but modified — save updated data and advance
      if (!USE_MOCK && recordIds[currentIndex]) {
        const updatedTask = { ...currentTask };
        saveToLarkBase(updatedTask, recordIds[currentIndex], '已标注');
      }
      setIsDirty(false);
      if (currentIndex < totalTasks - 1) {
        setTimeout(() => loadRowByIndex(currentIndex + 1), 300);
      }
      return;
    }

    // If already done and not dirty, do nothing (no toggle back to pending)
    if (currentTask.status === 'done') return;

    // Mark as done
    updateTask((task) => ({ ...task, status: 'done' as const }));
    setIsDirty(false);

    if (!USE_MOCK && recordIds[currentIndex]) {
      const updatedTask = { ...currentTask, status: 'done' as const };
      saveToLarkBase(updatedTask, recordIds[currentIndex], '已标注');

      // Auto-advance to next row
      if (currentIndex < totalTasks - 1) {
        setTimeout(() => loadRowByIndex(currentIndex + 1), 300);
      }
    }
  }, [currentTask, isDirty, updateTask, saveToLarkBase, currentIndex, totalTasks, loadRowByIndex, recordIds]);

  // ==================== Keyboard Shortcuts ====================

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement).tagName === 'INPUT') return;

      if (e.key === 'z' && (e.ctrlKey || e.metaKey)) {
        e.preventDefault();
        handleUndo();
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault();
        handlePrev();
      } else if (e.key === 'ArrowRight') {
        e.preventDefault();
        handleNext();
      } else if (e.key === 'Delete' || e.key === 'Backspace') {
        if (selectedPointId !== null) {
          e.preventDefault();
          handleDeletePoint(selectedPointId);
        }
      } else if (e.key === 's' && (e.ctrlKey || e.metaKey)) {
        // Ctrl+S = same as clicking done/update button
        e.preventDefault();
        handleMarkDone();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleUndo, handlePrev, handleNext, handleDeletePoint, selectedPointId, currentTask, saveToLarkBase]);

  // ==================== Render ====================

  if (!currentTask) {
    return (
      <div className="app-empty">
        <p>{USE_MOCK ? '没有可标注的任务' : '请在飞书多维表格中选择一条记录'}</p>
      </div>
    );
  }

  return (
    <div className="app">
      <header className="app-header">
        <div className="app-title">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="3" />
            <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
          </svg>
          <span>图片标注工具</span>
          {!USE_MOCK && (
            <span className="mode-badge">飞书</span>
          )}
        </div>
        <TaskNavigator
          currentIndex={currentIndex}
          totalTasks={totalTasks}
          imageName={currentTask.image_name}
          status={currentTask.status}
          isDirty={isDirty}
          onPrev={handlePrev}
          onNext={handleNext}
          onMarkDone={handleMarkDone}
        />
      </header>

      <Toolbar
        onUndo={handleUndo}
        onClear={handleClear}
        onFit={handleFit}
        onZoomIn={handleZoomIn}
        onZoomOut={handleZoomOut}
        scale={scale}
        pointCount={points.length}
        canUndo={history.length > 0}
      />

      <div className="app-body">
        <div className="canvas-area">
          <AnnotationCanvas
            key={USE_MOCK ? mockIndex : recordIds[currentRecordIndex]}
            imageUrl={currentTask.image_url}
            points={points}
            onAddPoint={handleAddPoint}
            onDeletePoint={handleDeletePoint}
            onMovePoint={handleMovePoint}
            selectedPointId={selectedPointId}
            onSelectPoint={setSelectedPointId}
          />
        </div>
        <div className="sidebar">
          <PointList
            points={points}
            selectedPointId={selectedPointId}
            onSelectPoint={setSelectedPointId}
            onDeletePoint={handleDeletePoint}
            onUpdateLabel={handleUpdateLabel}
          />
          <div className="shortcuts-help">
            <h4>快捷键</h4>
            <div className="shortcut-row"><kbd>Ctrl+Z</kbd><span>撤销</span></div>
            <div className="shortcut-row"><kbd>←</kbd> <kbd>→</kbd><span>切换任务</span></div>
            <div className="shortcut-row"><kbd>Delete</kbd><span>删除选中点</span></div>
            {!USE_MOCK && (
              <div className="shortcut-row"><kbd>Ctrl+S</kbd><span>保存</span></div>
            )}
            <div className="shortcut-row"><span className="mouse-icon">🖱️中键</span><span>拖拽平移</span></div>
            <div className="shortcut-row"><span className="mouse-icon">🖱️滚轮</span><span>缩放</span></div>
            <div className="shortcut-row"><span className="mouse-icon">🖱️右键</span><span>删除点</span></div>
          </div>
        </div>
      </div>
    </div>
  );
}