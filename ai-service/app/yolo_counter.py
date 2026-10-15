"""Conteo con YOLO26 + ByteTrack (Ultralytics), ejecutado en CPU por defecto."""
import os
import time

import cv2

from .counting import LineCounter, line_to_pixels

# Clases COCO -> categorías del sistema
COCO_TO_CATEGORY = {2: "car", 3: "motorcycle", 5: "bus", 7: "truck"}
DEVICE = os.getenv("DEVICE", "cpu")


def video_info(path: str) -> dict:
    cap = cv2.VideoCapture(path)
    if not cap.isOpened():
        raise ValueError("No se pudo abrir el video")
    info = {
        "fps": cap.get(cv2.CAP_PROP_FPS) or 25.0,
        "frames": int(cap.get(cv2.CAP_PROP_FRAME_COUNT)),
        "width": int(cap.get(cv2.CAP_PROP_FRAME_WIDTH)),
        "height": int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT)),
    }
    cap.release()
    return info


def run_yolo(path, line, interval_s=10, stride=2, imgsz=480, conf=0.3, model_name="yolo26n.pt"):
    import ultralytics
    from ultralytics import YOLO

    info = video_info(path)
    model = YOLO(model_name)  # modelo nuevo por trabajo: el tracker no arrastra estado de otros videos
    counter = None
    frames = 0
    t0 = time.perf_counter()

    stream = model.track(
        source=path,
        stream=True,
        persist=True,
        tracker="bytetrack.yaml",
        classes=list(COCO_TO_CATEGORY),
        conf=conf,
        imgsz=imgsz,
        vid_stride=stride,
        device=DEVICE,
        verbose=False,
    )
    for i, r in enumerate(stream):
        frames += 1
        if counter is None:
            h, w = r.orig_shape
            a, b = line_to_pixels(line, w, h)
            counter = LineCounter(a, b, interval_s)
        boxes = r.boxes
        if boxes is None or boxes.id is None:
            continue
        t = (i * stride) / info["fps"]
        ids = boxes.id.int().tolist()
        clss = boxes.cls.int().tolist()
        for tid, c, (x1, y1, x2, y2) in zip(ids, clss, boxes.xyxy.tolist()):
            counter.update(tid, COCO_TO_CATEGORY[c], ((x1 + x2) / 2, (y1 + y2) / 2), t)

    if counter is None:
        raise ValueError("El video no contiene fotogramas legibles")
    elapsed = time.perf_counter() - t0
    meta = {
        "method": "yolo26",
        "model": model_name,
        "ultralytics_version": ultralytics.__version__,
        "device": DEVICE,
        "params": {"interval_seconds": interval_s, "stride": stride, "imgsz": imgsz, "conf": conf, "line": line},
        "frames_processed": frames,
        "processing_fps": round(frames / elapsed, 2) if elapsed else None,
        "elapsed_s": round(elapsed, 2),
        "video": info,
    }
    return counter.results(), meta
