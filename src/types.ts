export interface LabelPoint {
    id: number;
    x: number;
    y: number;
    label?: string;
}

export interface TaskData {
    task_id: string;
    image_url: string;
    image_name: string;
    label_info: LabelPoint[];
    status: 'pending' | 'done';
}
