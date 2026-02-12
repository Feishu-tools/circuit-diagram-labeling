import React from 'react';
import { LabelPoint } from '../types';

interface PointListProps {
    points: LabelPoint[];
    selectedPointId: number | null;
    onSelectPoint: (id: number | null) => void;
    onDeletePoint: (id: number) => void;
    onUpdateLabel: (id: number, label: string) => void;
}

export default function PointList({
    points,
    selectedPointId,
    onSelectPoint,
    onDeletePoint,
    onUpdateLabel,
}: PointListProps) {
    return (
        <div className="point-list">
            <div className="point-list-header">
                <h3>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <line x1="8" y1="6" x2="21" y2="6" />
                        <line x1="8" y1="12" x2="21" y2="12" />
                        <line x1="8" y1="18" x2="21" y2="18" />
                        <line x1="3" y1="6" x2="3.01" y2="6" />
                        <line x1="3" y1="12" x2="3.01" y2="12" />
                        <line x1="3" y1="18" x2="3.01" y2="18" />
                    </svg>
                    标注点列表
                </h3>
                <span className="point-count-badge">{points.length}</span>
            </div>

            <div className="point-list-body">
                {points.length === 0 ? (
                    <div className="point-list-empty">
                        <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round">
                            <circle cx="12" cy="12" r="10" />
                            <line x1="12" y1="8" x2="12" y2="12" />
                            <line x1="12" y1="16" x2="12.01" y2="16" />
                        </svg>
                        <p>暂无标注点</p>
                        <p className="hint">点击图片添加标注点</p>
                    </div>
                ) : (
                    <ul>
                        {points.map((p, idx) => (
                            <li
                                key={p.id}
                                className={`point-item ${selectedPointId === p.id ? 'selected' : ''}`}
                                onClick={() => onSelectPoint(selectedPointId === p.id ? null : p.id)}
                            >
                                <div className="point-item-index">{idx + 1}</div>
                                <div className="point-item-coords">
                                    <span className="coord">x: {p.x}</span>
                                    <span className="coord">y: {p.y}</span>
                                </div>
                                <input
                                    className="point-item-label"
                                    type="text"
                                    placeholder="标签..."
                                    value={p.label || ''}
                                    onClick={(e) => e.stopPropagation()}
                                    onChange={(e) => onUpdateLabel(p.id, e.target.value)}
                                />
                                <button
                                    className="point-item-delete"
                                    title="删除此点"
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        onDeletePoint(p.id);
                                    }}
                                >
                                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                        <line x1="18" y1="6" x2="6" y2="18" />
                                        <line x1="6" y1="6" x2="18" y2="18" />
                                    </svg>
                                </button>
                            </li>
                        ))}
                    </ul>
                )}
            </div>

            {points.length > 0 && (
                <div className="point-list-footer">
                    <span className="footer-hint">💡 右键点击画布上的点可快速删除</span>
                </div>
            )}
        </div>
    );
}
