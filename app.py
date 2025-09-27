
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
        
            
    points_interpolated = points.interpolate_surface(grid_size=50)
        
    colors = ["red", "green", "blue", "orange", "purple", "cyan"]
    i = 0
    p = {}
    while len(points_interpolated) > 3:
    
        for z in range(0, 10):
            p[z], points_interpolated = points_interpolated.convex_hull(z/10, 0.5)
            print(f"Convex hull at z={z/10} has {len(p[z]) if p[z] is not None else 0} points, remaining points: {len(points_interpolated)}")
        
        
        for z, hull in p.items():
            if hull is None or len(hull) < 3:
                continue
            
            points_flattened = []
            for x, y, _ in hull.get_all(scale=canvas.size):
                points_flattened.append(x)
                points_flattened.append(y)
            
            canvas.add(svg.Polygon(
                points=points_flattened,
                stroke=colors[i],
                stroke_width=2,
                fill="none",
                fill_opacity=0,
            ))
            print(f"Added hull with {len(hull)} points at z={z}, color={colors[i]}")
            i = (i + 1) % len(colors)
            
        
       
    canvas.export()
    
    
