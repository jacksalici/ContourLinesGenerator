
import svg
from geometry import *
from utils import *

MAX_RADIUS = 10
WIDTH = 400
HEIGHT = 400



def draw(points: Points) -> svg.SVG:
    elements: list[svg.Element] = []
    
    for x, y, z in points.get_all(scale=[WIDTH, HEIGHT, MAX_RADIUS]):
        
        elements.append(svg.Circle(
                cx=x, cy=y, r=z,
                stroke="red",
                fill="transparent",
                stroke_width=2,
            ))
        
    return svg.SVG(
        viewBox=svg.ViewBoxSpec(0, 0, WIDTH, HEIGHT),
        elements=elements,
    )


if __name__ == '__main__':
    
    points = Points.generate(10, randomize=True)
    file = draw(points)
    export(file, "test.svg")
    
    
