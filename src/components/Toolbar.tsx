import React from 'react';

interface ToolbarProps {
    onUndo: () => void;
    onClear: () => void;
    onFit: () => void;
    onZoomIn: () => void;
    onZoomOut: () => void;
    scale: number;
    pointCount: number;
    canUndo: boolean;
}

export default function Toolbar({
    onUndo,
    onClear,
    onFit,
    onZoomIn,
    onZoomOut,
    scale,
    pointCount,
    canUndo,
}: ToolbarProps) {
    return (
        <div className="toolbar">
            <div className="toolbar-group">
                <button
                    className="toolbar-btn"
                    onClick={onUndo}
                    disabled={!canUndo}
                    title="撤销 (Ctrl+Z)"
                >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="1 4 1 10 7 10" />
                        <path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10" />
                    </svg>
                    <span>撤销</span>
                </button>
                <button
                    className="toolbar-btn toolbar-btn-danger"
                    onClick={onClear}
                    disabled={pointCount === 0}
                    title="清除所有标注点"
                >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="3 6 5 6 21 6" />
                        <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                    </svg>
                    <span>清除</span>
                </button>
            </div>

            <div className="toolbar-divider" />

            <div className="toolbar-group">
                <button className="toolbar-btn" onClick={onZoomOut} title="缩小">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <circle cx="11" cy="11" r="8" />
                        <line x1="21" y1="21" x2="16.65" y2="16.65" />
                        <line x1="8" y1="11" x2="14" y2="11" />
                    </svg>
                </button>
                <span className="toolbar-scale">{Math.round(scale * 100)}%</span>
                <button className="toolbar-btn" onClick={onZoomIn} title="放大">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <circle cx="11" cy="11" r="8" />
                        <line x1="21" y1="21" x2="16.65" y2="16.65" />
                        <line x1="11" y1="8" x2="11" y2="14" />
                        <line x1="8" y1="11" x2="14" y2="11" />
                    </svg>
                </button>
                <button className="toolbar-btn" onClick={onFit} title="适应屏幕">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3m0 18h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3" />
                    </svg>
                    <span>适应</span>
                </button>
            </div>

            <div className="toolbar-divider" />

            <div className="toolbar-group">
                <span className="toolbar-count">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <circle cx="12" cy="12" r="3" />
                        <path d="M12 2v4m0 12v4m10-10h-4M6 12H2m15.07-5.07l-2.83 2.83M9.76 14.24l-2.83 2.83m11.14 0l-2.83-2.83M9.76 9.76L6.93 6.93" />
                    </svg>
                    {pointCount} 个标注点
                </span>
            </div>
        </div>
    );
}
