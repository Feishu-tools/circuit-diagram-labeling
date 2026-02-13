import { bitable, IFieldMeta, FieldType } from '@lark-base-open/js-sdk';

// ==================== Types ====================

export interface FieldData {
    fieldId: string;
    fieldName: string;
    fieldType: number;
    value: any;
}

export interface RowData {
    success: boolean;
    tableId?: string;
    recordId?: string;
    data?: FieldData[];
    error?: string;
}

export interface RecordListData {
    success: boolean;
    recordIds?: string[];
    error?: string;
}

interface WriteOptions {
    fieldName: string;
    useCurrentSelection: boolean;
    tableId?: string;
    recordId?: string;
}

interface GetRowOptions {
    tableId: string;
    recordId: string;
    useCurrentSelection: boolean;
}

interface GetRecordIdsOptions {
    tableId: string;
    useCurrentSelection: boolean;
}

// ==================== Read Operations ====================

/**
 * Get structured data from the currently selected cell
 */
export async function getStructuredData() {
    try {
        const selection = await bitable.base.getSelection();
        if (!selection.tableId || !selection.recordId || !selection.fieldId) {
            return { success: false, error: '未选中有效单元格' };
        }

        const table = await bitable.base.getTableById(selection.tableId);
        const cellValue = await table.getCellValue(selection.fieldId, selection.recordId);

        return {
            success: true,
            tableId: selection.tableId,
            recordId: selection.recordId,
            fieldId: selection.fieldId,
            value: cellValue,
        };
    } catch (error) {
        console.error('getStructuredData error:', error);
        return { success: false, error: String(error) };
    }
}

/**
 * Get all field values for a specific row
 */
export async function getRowAllFields(options: GetRowOptions): Promise<RowData> {
    try {
        const { tableId, recordId } = options;
        const table = await bitable.base.getTableById(tableId);
        const fieldMetaList = await table.getFieldMetaList();

        const fieldDataList: FieldData[] = [];
        for (const meta of fieldMetaList) {
            try {
                const value = await table.getCellValue(meta.id, recordId);
                fieldDataList.push({
                    fieldId: meta.id,
                    fieldName: meta.name,
                    fieldType: meta.type,
                    value,
                });
            } catch (e) {
                fieldDataList.push({
                    fieldId: meta.id,
                    fieldName: meta.name,
                    fieldType: meta.type,
                    value: null,
                });
            }
        }

        return {
            success: true,
            tableId,
            recordId,
            data: fieldDataList,
        };
    } catch (error) {
        console.error('getRowAllFields error:', error);
        return { success: false, error: String(error) };
    }
}

/**
 * Get all record IDs for a table
 */
export async function getTableRecordIds(options: GetRecordIdsOptions): Promise<RecordListData> {
    try {
        const { tableId } = options;
        const table = await bitable.base.getTableById(tableId);
        const recordIdList = await table.getRecordIdList();

        return {
            success: true,
            recordIds: recordIdList,
        };
    } catch (error) {
        console.error('getTableRecordIds error:', error);
        return { success: false, error: String(error) };
    }
}

// ==================== Watch Operations ====================

/**
 * Watch selection change and return all fields of the selected row.
 * When a table switch happens (tableId changes, no recordId yet),
 * we still report the tableId so callers can detect table changes.
 */
export function watchRowAllFields(callback: (rowData: RowData) => void): () => void {
    const off = bitable.base.onSelectionChange(async ({ data }) => {
        try {
            const tableId = data.tableId;
            const recordId = data.recordId;

            if (!tableId) {
                callback({ success: false, error: '未选中有效表格' });
                return;
            }

            // Table switched but no record selected yet — report tableId so App can re-init
            if (!recordId) {
                callback({ success: true, tableId, data: [] });
                return;
            }

            const rowData = await getRowAllFields({
                tableId,
                recordId,
                useCurrentSelection: false,
            });

            callback(rowData);
        } catch (error) {
            console.error('watchRowAllFields error:', error);
            callback({ success: false, error: String(error) });
        }
    });

    return off;
}

/**
 * Watch selection change (simplified)
 */
export function watchSelectionData(callback: (data: any) => void): () => void {
    const off = bitable.base.onSelectionChange(async ({ data }) => {
        callback(data);
    });
    return off;
}

// ==================== Write Operations ====================

/**
 * Write a value to a field by name.
 * Automatically detects field type and formats accordingly:
 * - SingleSelect / MultiSelect: look up option by name, auto-create if missing
 * - Text / Url / other: write as text segments
 */
export async function writeDataToField(value: string, options: WriteOptions) {
    try {
        let tableId = options.tableId;
        let recordId = options.recordId;

        if (options.useCurrentSelection || !tableId || !recordId) {
            const selection = await bitable.base.getSelection();
            tableId = selection.tableId || tableId;
            recordId = selection.recordId || recordId;
        }

        if (!tableId || !recordId) {
            return { success: false, error: '无法确定目标记录' };
        }

        const table = await bitable.base.getTableById(tableId);
        const fieldMetaList = await table.getFieldMetaList();
        const targetField = fieldMetaList.find((f) => f.name === options.fieldName);

        if (!targetField) {
            return { success: false, error: `找不到字段 "${options.fieldName}"` };
        }

        // Handle SingleSelect / MultiSelect fields
        if (
            targetField.type === FieldType.SingleSelect ||
            targetField.type === FieldType.MultiSelect
        ) {
            const field = await table.getField(targetField.id);
            const selectField = field as any; // ISingleSelectField / IMultiSelectField
            const existingOptions = await selectField.getOptions();

            let option = existingOptions.find(
                (opt: { name: string }) => opt.name === value
            );

            // Auto-create option if it doesn't exist
            if (!option) {
                console.log(`选项 "${value}" 不存在，自动创建...`);
                await selectField.addOption(value);
                const updatedOptions = await selectField.getOptions();
                option = updatedOptions.find(
                    (opt: { name: string }) => opt.name === value
                );
            }

            if (!option) {
                return { success: false, error: `无法找到或创建选项 "${value}"` };
            }

            // SingleSelect: { id, text }, MultiSelect: [{ id, text }]
            const cellValue =
                targetField.type === FieldType.SingleSelect
                    ? { id: option.id, text: option.name }
                    : [{ id: option.id, text: option.name }];

            await table.setCellValue(targetField.id, recordId, cellValue as any);
        } else {
            // Text / Url / other: write as text segments
            await table.setCellValue(targetField.id, recordId, [
                { type: 'text' as const, text: value } as any,
            ]);
        }

        return { success: true };
    } catch (error) {
        console.error('writeDataToField error:', error);
        return { success: false, error: String(error) };
    }
}
