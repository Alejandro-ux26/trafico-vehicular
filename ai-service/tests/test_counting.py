from app.counting import CentroidTracker, LineCounter, crossing_direction, line_to_pixels, side_of_line, within_segment


def test_side_and_direction():
    a, b = (0, 5), (10, 5)  # línea horizontal
    assert side_of_line((5, 0), a, b) != side_of_line((5, 9), a, b)
    assert crossing_direction(-1, 1) == "forward"
    assert crossing_direction(1, -1) == "backward"
    assert crossing_direction(1, 2) is None


def test_within_segment():
    assert within_segment((5, 0), (0, 5), (10, 5))
    assert not within_segment((50, 0), (0, 5), (10, 5))


def test_line_to_pixels():
    assert line_to_pixels([0, 0.5, 1, 0.5], 100, 200) == ((0, 100), (100, 100))


def test_counter_counts_each_vehicle_once():
    c = LineCounter((0, 50), (100, 50), interval_s=10)
    for y in (10, 30, 45, 55, 70, 90, 60, 40):  # cruza y rebota; debe contarse una vez
        c.update(1, "car", (50, y), t_seconds=3)
    res = c.results()
    assert len(res) == 1 and res[0]["count"] == 1 and res[0]["category"] == "car"


def test_counter_ignores_crossing_outside_segment():
    c = LineCounter((0, 50), (100, 50), interval_s=10)
    c.update(1, "car", (500, 10), 1)
    c.update(1, "car", (500, 90), 2)
    assert c.results() == []


def test_counter_intervals_and_directions():
    c = LineCounter((0, 50), (100, 50), interval_s=10)
    c.update(1, "car", (50, 10), 1); c.update(1, "car", (50, 90), 2)       # forward, intervalo 0
    c.update(2, "bus", (50, 90), 11); c.update(2, "bus", (50, 10), 12)     # backward, intervalo 10
    res = {(r["interval_start_s"], r["category"], r["direction"]): r["count"] for r in c.results()}
    assert res == {(0, "car", "forward"): 1, (10, "bus", "backward"): 1}


def test_centroid_tracker_keeps_ids():
    t = CentroidTracker(max_dist=20)
    a = t.update([(10, 10), (100, 100)])
    b = t.update([(14, 12), (104, 103)])
    assert a == b and len(set(a)) == 2
    assert t.update([(14, 12), (104, 103), (300, 300)])[2] not in a
