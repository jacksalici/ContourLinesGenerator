
import svg
from geometry import *
from canvas import *

DEPTH = 10

if __name__ == '__main__':
    
    points: Points = Points.generate(20, randomize=True, seed=1, min_z=0.2, min_x=0.05, min_y=0.05, max_x=0.95, max_y=0.95, angles=True)
    canvas = Canvas()
    
    for x, y, z in points.get_all(scale=canvas.size):
        
        canvas.add(svg.Circle(
                cx=x, cy=y, r=10,
                fill="black",
                fill_opacity=z
            ))
        
            
    points_interpolated = points.interpolate_surface(grid_size=20)
        
    for x, y, z in points_interpolated.get_all(scale=canvas.size):
        
        canvas.add(svg.Circle(
                cx=x, cy=y, r=5,
                fill="red",
                fill_opacity=z
            ))
    
    p = {}
    for z in range(0, 10):
        p[z] = points_interpolated.convex_hull(z/10, 0.5)
    
    points_flattened = []
    for z, hull in p.items():
        for x, y, z in hull.get_all(scale=canvas.size):
            points_flattened.append(x)
            points_flattened.append(y)
        
        canvas.add(svg.Polygon(
            points=points_flattened,
            stroke="blue",
            stroke_width=2,
            fill="none",
            fill_opacity=0,
        ))
        
       
    canvas.export()
    
    
