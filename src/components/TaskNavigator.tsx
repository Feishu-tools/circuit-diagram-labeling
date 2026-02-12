import React from 'react';

interface TaskNavigatorProps {
    currentIndex: number;
    totalTasks: number;
    imageName: string;
    status: string;
    isDirty?: boolean;
    onPrev: () => void;
    onNext: () => void;
    onMarkDone: () => void;
}

export default function TaskNavigator({
    currentIndex,
    totalTasks,
    imageName,
    status,
    isDirty,
    onPrev,
    onNext,
    onMarkDone,
}: TaskNavigatorProps) {
    const progress = totalTasks > 0 ? ((currentIndex + 1) / totalTasks) * 100 : 0;

    return (
        <div className="task-navigator">
            <div className="task-nav-controls">
                <button
                    className="nav-btn"
                    onClick={onPrev}
                    disabled={currentIndex <= 0}
                    title="上一张 (←)"
                >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="15 18 9 12 15 6" />
                    </svg>
                </button>

                <div className="task-nav-info">
                    <span className="task-nav-counter">{currentIndex + 1} / {totalTasks}</span>
                    <span className="task-nav-name" title={imageName}>{imageName}</span>
                </div>

                <button
                    className="nav-btn"
                    onClick={onNext}
                    disabled={currentIndex >= totalTasks - 1}
                    title="下一张 (→)"
                >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="9 18 15 12 9 6" />
                    </svg>
                </button>
            </div>

            <button
                className={`mark-done-btn ${status === 'done' && !isDirty ? 'done' : ''} ${isDirty ? 'dirty' : ''}`}
                onClick={onMarkDone}
            >
                {status === 'done' && isDirty ? (
                    <>
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                            <circle cx="12" cy="12" r="3" />
                        </svg>
                        更新
                    </>
                ) : status === 'done' ? (
                    <>
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                            <polyline points="20 6 9 17 4 12" />
                        </svg>
                        已完成
                    </>
                ) : (
                    <>
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <circle cx="12" cy="12" r="10" />
                        </svg>
                        标记完成
                    </>
                )}
            </button>

            <div className="task-progress-bar">
                <div className="task-progress-fill" style={{ width: `${progress}%` }} />
            </div>
        </div>
    );
}
