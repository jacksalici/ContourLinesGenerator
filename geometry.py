import math
from typing import List, Self
import dataclasses
from dataclasses import dataclass
from scipy.interpolate import griddata


@dataclass
class Point:
    """Generic 3D point.

    Args:
        x (float): X coordinate.
        y (float): Y coordinate.
        z (float, optional): Z coordinate. Defaults to 0.0.
    """

    x: float
    y: float
    z: float = 0.0

    def __post_init__(self):
        pass

    def __repr__(self):
        return f"({self.x:.3f}, {self.y:.3f}, {self.z:.3f})"

    def __iter__(self):
        for field in dataclasses.fields(self):
            yield getattr(self, field.name)


class Points:
    def __init__(self, points: List[Point] = None):
        self._points = points if points is not None else []

    @staticmethod
    def generate(
        num_points: int,
        min_x: float = 0,
        max_x: float = 1,
        min_y: float = 0,
        max_y: float = 1,
        min_z: float = 0,
        max_z: float = 1,
        randomize: bool = False,
        seed: int = 42,
        angles: bool = False,
    ) -> Self:
        """Generate a set of points.
        Args:
            num_points (int): Number of points to generate.
            min_x (float, optional): Minimum X coordinate. Defaults to 0.
            max_x (float, optional): Maximum X coordinate. Defaults to 1.
            min_y (float, optional): Minimum Y coordinate. Defaults to 0.
            max_y (float, optional): Maximum Y coordinate. Defaults to 1.
            min_z (float, optional): Minimum Z coordinate. Defaults to 0.
            max_z (float, optional): Maximum Z coordinate. Defaults to 1.
            randomize (bool, optional): Whether to randomize the points. Defaults to False.
            seed (int, optional): Random seed. Defaults to 42.
            angles (bool, optional): Whether to distribute points in the angles too. Defaults to False.
        Returns:
            Points: Generated points as a class.
        """

        points = Points()
        
        if angles:            
            # Add corner points
            points.add(Point(min_x, min_y, min_z))
            points.add(Point(max_x, min_y, min_z))
            points.add(Point(max_x, max_y, min_z))
            points.add(Point(min_x, max_y, min_z))
            
            num_points -= 4
        
        
        for i in range(num_points):
            if randomize:
                import random

                random.seed(seed + i)
                x = random.uniform(min_x, max_x)
                y = random.uniform(min_y, max_y)
                z = random.uniform(min_z, max_z)
            else:
                if num_points == 1:
                    x = (min_x + max_x) / 2
                    y = (min_y + max_y) / 2
                    z = (min_z + max_z) / 2
                else:
                    x = min_x + (max_x - min_x) * i / (num_points - 1)
                    y = min_y + (max_y - min_y) * i / (num_points - 1)
                    z = min_z + (max_z - min_z) * i / (num_points - 1)
            points.add(Point(x, y, z))

        return points

    def add(self, point: Point):
        self._points.append(point)

    def get_all(self, scale: List[int] = None) -> List[Point]:
        """Get all points, optionally scaled.
        If 1 scale factor is provided, it is applied to both x and y, if 2, the first is x and the second y, if 3, the third is z.
        Args:
            scale (List[int], optional): Scale factors for x, y, z. Defaults to [1, 1, 1].
        Returns:
            List[Point]: List of points.
        """

        if scale is None:
            scale = [1, 1, 1]

        assert len(scale) <= 3, "Scale must be a list of at most 3 elements"

        if len(scale) == 1:
            scale = [scale[0], scale[0], scale[0]]
        elif len(scale) == 2:
            scale = [scale[0], scale[1], 1]
        elif len(scale) == 3:
            pass
        else:
            scale = [1, 1, 1]

        if scale != [1, 1, 1]:
            scaled_points = []
            for p in self._points:
                scaled_points.append(
                    Point(p.x * scale[0], p.y * scale[1], p.z * scale[2])
                )
            return scaled_points

        return self._points

    def interpolate_surface(
        self, grid_size: int = 10, method: str = "linear"
    ) -> Self:
        """Interpolate the points to create a surface grid.

        Args:
            grid_size (int, optional): Size of the grid. Defaults to 10.
            method (str, optional): Interpolation method. Defaults to 'linear'. Options are 'linear', 'nearest', 'cubic'.

        Returns:
            Points: Interpolated points as a class.
        """

        if len(self._points) < 3:
            print("Warning: Not enough points to interpolate")
            return self

        import numpy as np

        pts = np.array([[p.x, p.y] for p in self._points])
        vals = np.array([p.z for p in self._points])

        grid_x, grid_y = np.meshgrid(
            np.linspace(
                min(p.x for p in self._points),
                max(p.x for p in self._points),
                grid_size,
            ),
            np.linspace(
                min(p.y for p in self._points),
                max(p.y for p in self._points),
                grid_size,
            ),
        )

        grid_z = griddata(pts, vals, (grid_x, grid_y), method=method)

        interpolated_points = Points()
        for i in range(grid_size):
            for j in range(grid_size):
                if not np.isnan(grid_z[i, j]):
                    interpolated_points.add(
                        Point(grid_x[i, j], grid_y[i, j], grid_z[i, j])
                    )

        return interpolated_points

    def convex_hull(self, z = None, z_d = 0.01) -> List[Self]:
        """Compute the convex hull of the points (in XY plane) using Andrew's monotone chain.
        Returns:
            Points: Hull points in CCW order.
            Remaining points: Points not in the hull.
        """
        points = sorted(self._points, key=lambda p: (p.x, p.y))
        
        if z is not None:
            points = list(filter(lambda p: abs(p.z - z) <= z_d, points))
        
        if len(points) <= 3:
            print("Warning: Not enough points to compute convex hull")
            return None, self

        def cross(o: Point, a: Point, b: Point) -> float:
            return (a.x - o.x) * (b.y - o.y) - (a.y - o.y) * (b.x - o.x)

        # Build lower hull
        lower = []
        for p in points:
            while len(lower) >= 2 and cross(lower[-2], lower[-1], p) <= 0:
                lower.pop()
            lower.append(p)

        # Build upper hull
        upper = []
        for p in reversed(points):
            while len(upper) >= 2 and cross(upper[-2], upper[-1], p) <= 0:
                upper.pop()
            upper.append(p)

        # Concatenate, remove duplicates
        hull = Points(lower[:-1] + upper[:-1])
        remaining = Points([p for p in points if p not in hull._points])
        return hull, remaining

    def __len__(self):
        return len(self._points)

    def __repr__(self):
        return ";\n".join(str(p) for p in self._points)


class Line:
    def __init__(self, start: Point, end: Point):
        self.start = start
        self.end = end

    def __repr__(self):
        return f"Line({self.start} -> {self.end})"

    def getInterpolatedPoints(self, num_points: int) -> Points:
        points = Points()

        if num_points <= 0:
            return points
        elif num_points == 1:
            x = (self.start.x + self.end.x) / 2
            y = (self.start.y + self.end.y) / 2
            z = (self.start.z + self.end.z) / 2
            points.add(Point(x, y, z))
            return points

        for i in range(num_points):
            t = i / (num_points - 1)
            x = self.start.x + t * (self.end.x - self.start.x)
            y = self.start.y + t * (self.end.y - self.start.y)
            z = self.start.z + t * (self.end.z - self.start.z)
            points.add(Point(x, y, z))
        return points

    def getPointAtZ(self, z: float) -> Point | None:
        if (z < min(self.start.z, self.end.z)) or (z > max(self.start.z, self.end.z)):
            print("Warning: Z out of bounds")
            return None
        if self.start.z == self.end.z:
            print("Warning: Line is horizontal")
            return None  # Line is horizontal, no unique intersection point

        t = (z - self.start.z) / (self.end.z - self.start.z)
        x = self.start.x + t * (self.end.x - self.start.x)
        y = self.start.y + t * (self.end.y - self.start.y)

        return Point(x, y, z)


if __name__ == "__main__":
    pts = Points.generate(3, randomize=True)
    print("Generated Points:")
    print(pts)  # Example usage

    print("\nNumber of Points:", len(pts))

    scales = [[], [2], [2, 3], [2, 3, 4]]
    for scale in scales:
        print(f"\nScaled Points (scale={scale}):")
        for p in pts.get_all(scale=scale):
            print(p)

    for line in [
        Line(pts.get_all()[i], pts.get_all()[i + 1]) for i in range(len(pts) - 1)
    ]:
        print(f"\nInterpolated Points for {line}:")
        interp_pts = line.getInterpolatedPoints(5)
        for p in interp_pts.get_all():
            print(p)

        test_zs = [0.0, 0.5, 1.0]
        for z in test_zs:
            pt_at_z = line.getPointAtZ(z)
            print(f"\nPoint at Z={z}: {pt_at_z}")
