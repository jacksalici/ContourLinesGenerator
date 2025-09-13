
import svg
from geometry import *
from canvas import *
from utils import *

DEPTH = 10

if __name__ == '__main__':
    
    points = Points.generate(10, randomize=True, seed=14)
    canvas = Canvas()
    
    for x, y, z in points.get_all(scale=canvas.size):
        
        canvas.add(svg.Circle(
                cx=x, cy=y, r=10,
                fill="black",
                fill_opacity=z
            ))
        
    for line in [Line(points.get_all()[i], points.get_all()[i+1]) for i in range(len(points)-1)]:
        for x, y, z in line.getInterpolatedPoints(15).get_all(scale=canvas.size):
            canvas.add(svg.Circle(
                cx=x, cy=y, r=2,
                fill="red",
                fill_opacity=z
            ))
    
    canvas.export()
    
    
