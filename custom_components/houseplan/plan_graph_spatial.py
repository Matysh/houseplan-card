"""Exact, bounded AABB candidate index shared by graph checks and migration."""
from .plan_graph_exact import ExactPoint as P


class SegmentTree:
    def __init__(self, items, depth=0):
        self.lo = P(min(min(s["a"].x, s["b"].x) for s in items), min(min(s["a"].y, s["b"].y) for s in items))
        self.hi = P(max(max(s["a"].x, s["b"].x) for s in items), max(max(s["a"].y, s["b"].y) for s in items))
        self.items, self.children = None, None
        if len(items) <= 8:
            self.items = items
        else:
            axis = "x" if depth % 2 == 0 else "y"
            ordered = sorted(items, key=lambda s: getattr(s["a"], axis) + getattr(s["b"], axis))
            middle = len(ordered) // 2
            self.children = (SegmentTree(ordered[:middle], depth+1), SegmentTree(ordered[middle:], depth+1))

    def query(self, lo, hi):
        if self.hi.x < lo.x or self.hi.y < lo.y or self.lo.x > hi.x or self.lo.y > hi.y:
            return []
        if self.items is not None:
            return self.items
        return self.children[0].query(lo, hi) + self.children[1].query(lo, hi)
