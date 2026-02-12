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
 * Watch selection change and return all fields of the selected row
 */
export function watchRowAllFields(callback: (rowData: RowData) => void): () => void {
    const off = bitable.base.onSelectionChange(async ({ data }) => {
        try {
            const tableId = data.tableId;
            const recordId = data.recordId;

            if (!tableId || !recordId) {
                callback({ success: false, error: '未选中有效记录' });
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
 * Write a text value to a field by name
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

        await table.setCellValue(targetField.id, recordId, [
            { type: 'text' as const, text: value } as any,
        ]);

        return { success: true };
    } catch (error) {
        console.error('writeDataToField error:', error);
        return { success: false, error: String(error) };
    }
}
