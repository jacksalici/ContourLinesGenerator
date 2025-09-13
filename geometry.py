import math
from typing import List, Self


class Point:
    def __init__(self, x: float, y: float, z: float = 0.0):
        """Generic 3D point.

        Args:
            x (float): X coordinate, in 0..1 range.
            y (float): Y coordinate, in 0..1 range.
            z (float, optional): Z coordinate, in 0..1 range. Defaults to 0.0.
        """
        for coord in (x, y, z):
            assert 0.0 <= coord <= 1.0, "Coordinates must be in 0..1 range"

        self.x = x
        self.y = y
        self.z = z

    def __repr__(self):
        return f"[{self.x}, {self.y}, {self.z}]"


class Points:
    def __init__(self, points: List[Point] = []):
        self._points = points

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
        Returns:
            Points: Generated points as a class.
        """
        
        points = Points()
        for i in range(num_points):
            if randomize:
                import random

                random.seed(seed + i)
                x = random.uniform(min_x, max_x)
                y = random.uniform(min_y, max_y)
                z = random.uniform(min_z, max_z)
            else:
                x = min_x + (max_x - min_x) * i / (num_points - 1)
                y = min_y + (max_y - min_y) * i / (num_points - 1)
                z = min_z + (max_z - min_z) * i / (num_points - 1)
            points.add(Point(x, y, z))
        
        return points

    def add(self, point: Point):
        if self._points is None:
            self._points = []
        self._points.append(point)
    
    def get_all(self) -> List[Point]:
        return self._points
    
    def __len__(self):
        return len(self._points)

    def __repr__(self):
        return ";\n".join(str(p) for p in self._points)


if __name__ == '__main__':
    pts = Points.generate(10, randomize=True)
    print(pts)  # Example usage