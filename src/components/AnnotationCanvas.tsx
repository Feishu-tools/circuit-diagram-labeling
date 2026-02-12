import React, { useRef, useEffect, useState, useCallback } from 'react';
import { LabelPoint } from '../types';

interface AnnotationCanvasProps {
    imageUrl: string;
    points: LabelPoint[];
    onAddPoint: (x: number, y: number) => void;
    onDeletePoint: (id: number) => void;
    onMovePoint: (id: number, x: number, y: number) => void;
    selectedPointId: number | null;
    onSelectPoint: (id: number | null) => void;
}

interface ViewState {
    scale: number;
    offsetX: number;
    offsetY: number;
}

const POINT_RADIUS = 6;
const POINT_HIT_RADIUS = 12;
const POINT_HOVER_RADIUS = 10;
const MIN_SCALE = 0.1;
const MAX_SCALE = 10;

export default function AnnotationCanvas({
    imageUrl,
    points,
    onAddPoint,
    onDeletePoint,
    onMovePoint,
    selectedPointId,
    onSelectPoint,
}: AnnotationCanvasProps) {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const containerRef = useRef<HTMLDivElement>(null);
    const imageRef = useRef<HTMLImageElement | null>(null);
    const [view, setView] = useState<ViewState>({ scale: 1, offsetX: 0, offsetY: 0 });
    const [mousePos, setMousePos] = useState<{ x: number; y: number } | null>(null);
    const [imagePixelPos, setImagePixelPos] = useState<{ x: number; y: number } | null>(null);
    const [hoveredPointId, setHoveredPointId] = useState<number | null>(null);
    const [isPanning, setIsPanning] = useState(false);
    const [panStart, setPanStart] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
    const [draggingPointId, setDraggingPointId] = useState<number | null>(null);
    const [dragStartPos, setDragStartPos] = useState<{ x: number; y: number } | null>(null);
    const [hasDragged, setHasDragged] = useState(false);
    const [imageLoaded, setImageLoaded] = useState(false);
    const [imageError, setImageError] = useState(false);
    const animFrameRef = useRef<number>(0);

    // Load image
    useEffect(() => {
        const img = new Image();
        img.crossOrigin = 'anonymous';
        setImageLoaded(false);
        setImageError(false);
        img.onload = () => {
            imageRef.current = img;
            setImageLoaded(true);
            // Initial scale 200%, centered
            if (containerRef.current) {
                const containerW = containerRef.current.clientWidth;
                const containerH = containerRef.current.clientHeight;
                const initScale = 2;
                setView({
                    scale: initScale,
                    offsetX: (containerW - img.width * initScale) / 2,
                    offsetY: (containerH - img.height * initScale) / 2,
                });
            }
        };
        img.onerror = () => {
            setImageError(true);
        };
        img.src = imageUrl;

        return () => {
            img.onload = null;
            img.onerror = null;
        };
    }, [imageUrl]);

    // Screen coords to image pixel coords
    const screenToImage = useCallback(
        (sx: number, sy: number): { x: number; y: number } => {
            return {
                x: Math.round((sx - view.offsetX) / view.scale),
                y: Math.round((sy - view.offsetY) / view.scale),
            };
        },
        [view]
    );

    // Image pixel coords to screen coords
    const imageToScreen = useCallback(
        (ix: number, iy: number): { x: number; y: number } => {
            return {
                x: ix * view.scale + view.offsetX,
                y: iy * view.scale + view.offsetY,
            };
        },
        [view]
    );

    // Find point near screen position
    const findPointAtScreen = useCallback(
        (sx: number, sy: number): LabelPoint | null => {
            for (let i = points.length - 1; i >= 0; i--) {
                const p = points[i];
                const sp = imageToScreen(p.x, p.y);
                const dx = sp.x - sx;
                const dy = sp.y - sy;
                if (dx * dx + dy * dy <= POINT_HIT_RADIUS * POINT_HIT_RADIUS) {
                    return p;
                }
            }
            return null;
        },
        [points, imageToScreen]
    );

    // Draw canvas
    const draw = useCallback(() => {
        const canvas = canvasRef.current;
        const ctx = canvas?.getContext('2d');
        const img = imageRef.current;
        if (!canvas || !ctx) return;

        const dpr = window.devicePixelRatio || 1;
        const container = containerRef.current;
        if (container) {
            const w = container.clientWidth;
            const h = container.clientHeight;
            if (canvas.width !== w * dpr || canvas.height !== h * dpr) {
                canvas.width = w * dpr;
                canvas.height = h * dpr;
                canvas.style.width = w + 'px';
                canvas.style.height = h + 'px';
            }
        }

        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        ctx.clearRect(0, 0, canvas.width, canvas.height);

        // Draw checkerboard background
        const cw = canvas.width / dpr;
        const ch = canvas.height / dpr;
        const gridSize = 16;
        for (let y = 0; y < ch; y += gridSize) {
            for (let x = 0; x < cw; x += gridSize) {
                const isLight = ((x / gridSize) + (y / gridSize)) % 2 === 0;
                ctx.fillStyle = isLight ? '#2a2a2e' : '#252528';
                ctx.fillRect(x, y, gridSize, gridSize);
            }
        }

        // Draw image
        if (img && imageLoaded) {
            ctx.save();
            ctx.translate(view.offsetX, view.offsetY);
            ctx.scale(view.scale, view.scale);
            ctx.drawImage(img, 0, 0);
            ctx.restore();
        }

        // Draw points
        points.forEach((p, idx) => {
            const sp = imageToScreen(p.x, p.y);
            const isHovered = hoveredPointId === p.id;
            const isSelected = selectedPointId === p.id;
            const radius = isHovered || isSelected ? POINT_HOVER_RADIUS : POINT_RADIUS;

            // Outer ring
            ctx.beginPath();
            ctx.arc(sp.x, sp.y, radius + 2, 0, Math.PI * 2);
            ctx.fillStyle = isSelected ? 'rgba(59, 130, 246, 0.4)' : 'rgba(255, 255, 255, 0.3)';
            ctx.fill();

            // Inner circle
            ctx.beginPath();
            ctx.arc(sp.x, sp.y, radius, 0, Math.PI * 2);
            ctx.fillStyle = isSelected
                ? '#3b82f6'
                : isHovered
                    ? '#f59e0b'
                    : '#ef4444';
            ctx.fill();
            ctx.strokeStyle = '#fff';
            ctx.lineWidth = 1.5;
            ctx.stroke();


            // Label text (if exists)
            if (p.label) {
                ctx.fillStyle = '#fff';
                ctx.font = '11px Inter, sans-serif';
                ctx.textAlign = 'left';
                ctx.textBaseline = 'top';
                const labelBg = isSelected ? '#3b82f6' : '#555';
                const textW = ctx.measureText(p.label).width;
                ctx.fillStyle = labelBg;
                ctx.fillRect(sp.x + radius + 4, sp.y - 8, textW + 8, 18);
                ctx.fillStyle = '#fff';
                ctx.fillText(p.label, sp.x + radius + 8, sp.y - 5);
            }
        });

        // Draw crosshair
        if (mousePos && !isPanning) {
            ctx.setLineDash([6, 4]);
            ctx.strokeStyle = 'rgba(239, 68, 68, 0.8)';
            ctx.lineWidth = 5;

            // Horizontal line
            ctx.beginPath();
            ctx.moveTo(0, mousePos.y);
            ctx.lineTo(cw, mousePos.y);
            ctx.stroke();

            // Vertical line
            ctx.beginPath();
            ctx.moveTo(mousePos.x, 0);
            ctx.lineTo(mousePos.x, ch);
            ctx.stroke();

            ctx.setLineDash([]);

            // Coordinate tooltip
            if (imagePixelPos && img) {
                const inBounds =
                    imagePixelPos.x >= 0 &&
                    imagePixelPos.y >= 0 &&
                    imagePixelPos.x < img.width &&
                    imagePixelPos.y < img.height;

                if (inBounds) {
                    const text = `(${imagePixelPos.x}, ${imagePixelPos.y})`;
                    ctx.font = '12px "SF Mono", "Fira Code", monospace';
                    const textW = ctx.measureText(text).width;
                    const tooltipX = mousePos.x + 16;
                    const tooltipY = mousePos.y - 28;

                    ctx.fillStyle = 'rgba(0, 0, 0, 0.75)';
                    ctx.beginPath();
                    ctx.roundRect(tooltipX - 4, tooltipY - 4, textW + 12, 22, 4);
                    ctx.fill();

                    ctx.fillStyle = '#3b82f6';
                    ctx.fillText(text, tooltipX + 2, tooltipY + 12);
                }
            }
        }
    }, [view, points, mousePos, imagePixelPos, hoveredPointId, selectedPointId, imageLoaded, isPanning, imageToScreen]);

    // Animation loop
    useEffect(() => {
        const render = () => {
            draw();
            animFrameRef.current = requestAnimationFrame(render);
        };
        animFrameRef.current = requestAnimationFrame(render);
        return () => cancelAnimationFrame(animFrameRef.current);
    }, [draw]);

    // Handle resize
    useEffect(() => {
        const observer = new ResizeObserver(() => {
            draw();
        });
        if (containerRef.current) {
            observer.observe(containerRef.current);
        }
        return () => observer.disconnect();
    }, [draw]);

    // Mouse move
    const handleMouseMove = useCallback(
        (e: React.MouseEvent) => {
            const rect = canvasRef.current?.getBoundingClientRect();
            if (!rect) return;
            const sx = e.clientX - rect.left;
            const sy = e.clientY - rect.top;
            setMousePos({ x: sx, y: sy });
            setImagePixelPos(screenToImage(sx, sy));

            if (draggingPointId !== null) {
                // Dragging a point
                if (dragStartPos) {
                    const dx = e.clientX - dragStartPos.x;
                    const dy = e.clientY - dragStartPos.y;
                    if (Math.abs(dx) > 3 || Math.abs(dy) > 3) {
                        setHasDragged(true);
                    }
                }
                const img = imageRef.current;
                if (!img) return;
                const ip = screenToImage(sx, sy);
                const cx = Math.max(0, Math.min(img.width - 1, ip.x));
                const cy = Math.max(0, Math.min(img.height - 1, ip.y));
                onMovePoint(draggingPointId, cx, cy);
            } else if (isPanning) {
                setView((v) => ({
                    ...v,
                    offsetX: v.offsetX + (e.clientX - panStart.x),
                    offsetY: v.offsetY + (e.clientY - panStart.y),
                }));
                setPanStart({ x: e.clientX, y: e.clientY });
            } else {
                const found = findPointAtScreen(sx, sy);
                setHoveredPointId(found?.id ?? null);
            }
        },
        [isPanning, panStart, screenToImage, findPointAtScreen, draggingPointId, dragStartPos, onMovePoint]
    );

    // Mouse down
    const handleMouseDown = useCallback(
        (e: React.MouseEvent) => {
            // Middle button for panning
            if (e.button === 1) {
                e.preventDefault();
                setIsPanning(true);
                setPanStart({ x: e.clientX, y: e.clientY });
                return;
            }
            // Left button — check if on a point to start dragging
            if (e.button === 0) {
                const rect = canvasRef.current?.getBoundingClientRect();
                if (!rect) return;
                const sx = e.clientX - rect.left;
                const sy = e.clientY - rect.top;
                const found = findPointAtScreen(sx, sy);
                if (found) {
                    setDraggingPointId(found.id);
                    setDragStartPos({ x: e.clientX, y: e.clientY });
                    setHasDragged(false);
                    onSelectPoint(found.id);
                }
            }
        },
        [findPointAtScreen, onSelectPoint]
    );

    // Mouse up
    const handleMouseUp = useCallback(
        (e: React.MouseEvent) => {
            if (e.button === 1) {
                setIsPanning(false);
            }
            if (draggingPointId !== null) {
                setDraggingPointId(null);
                setDragStartPos(null);
            }
        },
        [draggingPointId]
    );

    // Click to add point
    const handleClick = useCallback(
        (e: React.MouseEvent) => {
            if (isPanning) return;
            // If we just finished dragging, don't add a new point
            if (hasDragged) {
                setHasDragged(false);
                return;
            }
            const rect = canvasRef.current?.getBoundingClientRect();
            if (!rect) return;
            const sx = e.clientX - rect.left;
            const sy = e.clientY - rect.top;

            // Check if clicking an existing point — select it
            const found = findPointAtScreen(sx, sy);
            if (found) {
                onSelectPoint(found.id);
                return;
            }

            // Otherwise add new point
            const img = imageRef.current;
            if (!img) return;
            const ip = screenToImage(sx, sy);
            if (ip.x >= 0 && ip.y >= 0 && ip.x < img.width && ip.y < img.height) {
                onAddPoint(ip.x, ip.y);
            }
        },
        [isPanning, hasDragged, findPointAtScreen, screenToImage, onAddPoint, onSelectPoint]
    );

    // Right click to delete
    const handleContextMenu = useCallback(
        (e: React.MouseEvent) => {
            e.preventDefault();
            const rect = canvasRef.current?.getBoundingClientRect();
            if (!rect) return;
            const sx = e.clientX - rect.left;
            const sy = e.clientY - rect.top;
            const found = findPointAtScreen(sx, sy);
            if (found) {
                onDeletePoint(found.id);
            }
        },
        [findPointAtScreen, onDeletePoint]
    );

    // Wheel to zoom
    const handleWheel = useCallback(
        (e: React.WheelEvent) => {
            e.preventDefault();
            const rect = canvasRef.current?.getBoundingClientRect();
            if (!rect) return;
            const sx = e.clientX - rect.left;
            const sy = e.clientY - rect.top;

            const zoomFactor = e.deltaY < 0 ? 1.05 : 1 / 1.05;
            const newScale = Math.max(MIN_SCALE, Math.min(MAX_SCALE, view.scale * zoomFactor));

            // Zoom centered on mouse position
            setView({
                scale: newScale,
                offsetX: sx - (sx - view.offsetX) * (newScale / view.scale),
                offsetY: sy - (sy - view.offsetY) * (newScale / view.scale),
            });
        },
        [view]
    );

    // Mouse leave
    const handleMouseLeave = useCallback(() => {
        setMousePos(null);
        setImagePixelPos(null);
        setHoveredPointId(null);
        if (isPanning) setIsPanning(false);
    }, [isPanning]);

    // Fit to screen
    const fitToScreen = useCallback(() => {
        const img = imageRef.current;
        const container = containerRef.current;
        if (!img || !container) return;
        const cw = container.clientWidth;
        const ch = container.clientHeight;
        const scaleX = (cw - 40) / img.width;
        const scaleY = (ch - 40) / img.height;
        const fitScale = Math.min(scaleX, scaleY, 1);
        setView({
            scale: fitScale,
            offsetX: (cw - img.width * fitScale) / 2,
            offsetY: (ch - img.height * fitScale) / 2,
        });
    }, []);

    // Expose fitToScreen and scale via a global-ish mechanism
    useEffect(() => {
        (window as any).__annotationCanvas = {
            fitToScreen,
            getScale: () => view.scale,
            setScale: (s: number) => {
                const container = containerRef.current;
                if (!container) return;
                const cx = container.clientWidth / 2;
                const cy = container.clientHeight / 2;
                const newScale = Math.max(MIN_SCALE, Math.min(MAX_SCALE, s));
                setView((v) => ({
                    scale: newScale,
                    offsetX: cx - (cx - v.offsetX) * (newScale / v.scale),
                    offsetY: cy - (cy - v.offsetY) * (newScale / v.scale),
                }));
            },
        };
        return () => {
            delete (window as any).__annotationCanvas;
        };
    }, [fitToScreen, view.scale]);

    return (
        <div
            ref={containerRef}
            className="annotation-canvas-container"
            style={{ cursor: draggingPointId ? 'grabbing' : isPanning ? 'grabbing' : hoveredPointId ? 'grab' : 'crosshair' }}
        >
            {imageError && (
                <div className="canvas-error">
                    <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                        <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
                        <circle cx="8.5" cy="8.5" r="1.5" />
                        <polyline points="21 15 16 10 5 21" />
                    </svg>
                    <p>图片加载失败</p>
                </div>
            )}
            {!imageLoaded && !imageError && (
                <div className="canvas-loading">
                    <div className="spinner" />
                    <p>加载图片中...</p>
                </div>
            )}
            <canvas
                ref={canvasRef}
                onClick={handleClick}
                onContextMenu={handleContextMenu}
                onMouseMove={handleMouseMove}
                onMouseDown={handleMouseDown}
                onMouseUp={handleMouseUp}
                onWheel={handleWheel}
                onMouseLeave={handleMouseLeave}
            />
            {/* Image info overlay */}
            {imageLoaded && imageRef.current && (
                <div className="canvas-info-overlay">
                    <span className="info-badge">
                        {imageRef.current.width} × {imageRef.current.height}px
                    </span>
                    <span className="info-badge">
                        {Math.round(view.scale * 100)}%
                    </span>
                </div>
            )}
        </div>
    );
}
