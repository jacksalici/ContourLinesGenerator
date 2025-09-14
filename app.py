
import svg
from geometry import *
from canvas import *

DEPTH = 10

if __name__ == '__main__':
    
    points: Points = Points.generate(10, randomize=True, seed=1, min_z=0.2)
    canvas = Canvas()
    
    for x, y, z in points.get_all(scale=canvas.size):
        
        canvas.add(svg.Circle(
                cx=x, cy=y, r=10,
                fill="black",
                fill_opacity=z
            ))
        
            
    points_interpolated = points.interpolate_surface()
        
    for x, y, z in points_interpolated.get_all(scale=canvas.size):
        
        canvas.add(svg.Circle(
                cx=x, cy=y, r=5,
                fill="red",
                fill_opacity=z
            ))
       
    canvas.export()
    
    
