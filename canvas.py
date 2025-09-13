import svg
from geometry import *
from typing import List

WIDTH = 1000
HEIGHT = 1000


class Canvas:
    def __init__(self, width: int = WIDTH, height: int = HEIGHT):
        self.width = width
        self.height = height
        self._elements: list[svg.Element] = []

    @property
    def size(self) -> List[int]:
        """Get the size of the canvas as a list [width, height]."""

        return [self.width, self.height]

    def add(self, element: svg.Element):
        """Add an SVG element to the canvas.

        Args:
            element (svg.Element): The SVG element to add.
        """

        self._elements.append(element)

    def render(self) -> svg.SVG:
        """Render the canvas as an SVG object.

        Returns:
            svg.SVG: The rendered SVG object.
        """
        return svg.SVG(
            viewBox=svg.ViewBoxSpec(0, 0, self.width, self.height),
            elements=self._elements,
        )

    def export(self, filename: str = "canvas.svg"):
        """Export the canvas to an SVG file.

        Args:
            filename (str, optional): The filename to export to. Defaults to "canvas.svg".
        """
        with open(filename, "w") as f:
            f.write(self.render().as_str())
