"""Baseline sin deep learning: sustracción de fondo (MOG2) + contornos + tracker de centroides.

Limitación conocida (documentar en el informe): la categoría se estima solo por el área del
contorno, por lo que es mucho menos exacta que el detector YOLO26.
"""
import time

import cv2

from .counting import CentroidTracker, LineCounter, line_to_pixels
from .yolo_counter import video_info

WORK_WIDTH = 480


def category_from_area(ratio: float) -> str:
    if ratio < 0.01:
        return "motorcycle"
    if ratio < 0.04:
        return "car"
    return "truck"


def run_baseline(path, line, interval_s=10, stride=2, min_area_ratio=0.002):
    info = video_info(path)
    cap = cv2.VideoCapture(path)
    sub = cv2.createBackgroundSubtractorMOG2(history=300, varThreshold=32, detectShadows=True)
    kernel = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (5, 5))
    tracker = CentroidTracker()
    counter = None
    idx, frames = -1, 0
    t0 = time.perf_counter()

    while True:
        ok, frame = cap.read()
        if not ok:
            break
        idx += 1
        if idx % stride:
            continue
        scale = WORK_WIDTH / frame.shape[1]
        small = cv2.resize(frame, (WORK_WIDTH, int(frame.shape[0] * scale)))
        h, w = small.shape[:2]
        if counter is None:
            a, b = line_to_pixels(line, w, h)
            counter = LineCounter(a, b, interval_s)
        mask = sub.apply(small)
        _, mask = cv2.threshold(mask, 200, 255, cv2.THRESH_BINARY)  # descarta sombras (valor 127)
        mask = cv2.morphologyEx(mask, cv2.MORPH_OPEN, kernel)
        mask = cv2.dilate(mask, kernel, iterations=2)
        contours, _ = cv2.findContours(mask, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)

        dets = []
        for c in contours:
            ratio = cv2.contourArea(c) / (w * h)
            if ratio < min_area_ratio:
                continue
            x, y, bw, bh = cv2.boundingRect(c)
            dets.append(((x + bw / 2, y + bh / 2), ratio))
        ids = tracker.update([d[0] for d in dets])
        t = idx / info["fps"]
        for tid, (center, ratio) in zip(ids, dets):
            counter.update(tid, category_from_area(ratio), center, t)
        frames += 1

    cap.release()
    if counter is None:
        raise ValueError("El video no contiene fotogramas legibles")
    elapsed = time.perf_counter() - t0
    meta = {
        "method": "baseline",
        "model": "opencv-mog2",
        "opencv_version": cv2.__version__,
        "device": "cpu",
        "params": {"interval_seconds": interval_s, "stride": stride, "min_area_ratio": min_area_ratio, "line": line},
        "frames_processed": frames,
        "processing_fps": round(frames / elapsed, 2) if elapsed else None,
        "elapsed_s": round(elapsed, 2),
        "video": info,
    }
    return counter.results(), meta
