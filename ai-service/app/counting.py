"""Lógica pura de conteo (sin dependencias pesadas): geometría, conteo por línea y tracker de centroides.

Se mantiene separada de YOLO/OpenCV para poder probarla con pruebas unitarias.
"""
from collections import defaultdict
from typing import Dict, List, Optional, Tuple

Point = Tuple[float, float]


def side_of_line(p: Point, a: Point, b: Point) -> float:
    """Signo (producto cruzado) del lado de la línea a-b en que está el punto p."""
    return (b[0] - a[0]) * (p[1] - a[1]) - (b[1] - a[1]) * (p[0] - a[0])


def within_segment(p: Point, a: Point, b: Point, margin: float = 0.05) -> bool:
    """True si la proyección de p cae dentro del segmento a-b (con un pequeño margen)."""
    dx, dy = b[0] - a[0], b[1] - a[1]
    length2 = dx * dx + dy * dy
    if length2 == 0:
        return False
    t = ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / length2
    return -margin <= t <= 1 + margin


def crossing_direction(prev_side: float, cur_side: float) -> Optional[str]:
    """'forward' si pasa de negativo a positivo, 'backward' al revés, None si no cruzó."""
    if prev_side < 0 < cur_side:
        return "forward"
    if prev_side > 0 > cur_side:
        return "backward"
    return None


def line_to_pixels(line: List[float], width: int, height: int) -> Tuple[Point, Point]:
    """Convierte la línea normalizada [x1,y1,x2,y2] (0..1) a píxeles."""
    x1, y1, x2, y2 = line
    return (x1 * width, y1 * height), (x2 * width, y2 * height)


class LineCounter:
    """Cuenta cada vehículo (track id) una sola vez cuando cruza la línea."""

    def __init__(self, a: Point, b: Point, interval_s: int):
        self.a, self.b, self.interval_s = a, b, interval_s
        self.last_side: Dict[int, float] = {}
        self.counted = set()
        self.agg = defaultdict(int)

    def update(self, track_id: int, category: str, center: Point, t_seconds: float) -> None:
        side = side_of_line(center, self.a, self.b)
        prev = self.last_side.get(track_id)
        if side != 0:
            self.last_side[track_id] = side
        if prev is None or track_id in self.counted:
            return
        direction = crossing_direction(prev, side)
        if direction and within_segment(center, self.a, self.b):
            self.counted.add(track_id)
            bucket = int(t_seconds // self.interval_s)
            self.agg[(bucket, category, direction)] += 1

    def results(self) -> List[dict]:
        return [
            {
                "interval_start_s": bucket * self.interval_s,
                "category": category,
                "direction": direction,
                "count": n,
            }
            for (bucket, category, direction), n in sorted(self.agg.items())
        ]


class CentroidTracker:
    """Tracker simple por distancia de centroides (usado por el baseline OpenCV)."""

    def __init__(self, max_dist: float = 60.0, max_missing: int = 5):
        self.max_dist, self.max_missing = max_dist, max_missing
        self.next_id = 0
        self.objs: Dict[int, Tuple[Point, int]] = {}

    def update(self, centers: List[Point]) -> List[int]:
        ids: List[Optional[int]] = [None] * len(centers)
        pairs = sorted(
            (
                ((oc[0] - c[0]) ** 2 + (oc[1] - c[1]) ** 2) ** 0.5,
                oid,
                j,
            )
            for oid, (oc, _) in self.objs.items()
            for j, c in enumerate(centers)
        )
        used = set()
        for dist, oid, j in pairs:
            if dist > self.max_dist:
                break
            if oid in used or ids[j] is not None:
                continue
            ids[j] = oid
            used.add(oid)
            self.objs[oid] = (centers[j], 0)
        for oid in list(self.objs):
            if oid not in used:
                c, missing = self.objs[oid]
                if missing + 1 > self.max_missing:
                    del self.objs[oid]
                else:
                    self.objs[oid] = (c, missing + 1)
        for j in range(len(centers)):
            if ids[j] is None:
                ids[j] = self.next_id
                self.objs[self.next_id] = (centers[j], 0)
                self.next_id += 1
        return ids  # type: ignore[return-value]
