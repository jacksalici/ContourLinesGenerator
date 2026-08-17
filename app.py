
import svg
from geometry import *
from canvas import *

if __name__ == '__main__':
    
    points: Points = Points.generate(20, randomize=True, seed=1, min_z=0.2, min_x=0.05, min_y=0.05, max_x=0.95, max_y=0.95, angles=True)
    canvas = Canvas()
    
    for x, y, z in points.get_all(scale=canvas.size):
        
        canvas.add(svg.Circle(
                cx=x, cy=y, r=10,
                fill="black",
                fill_opacity=z
            ))
        
   
    lines = [Line(points.get_all(scale=canvas.size)[i], points.get_all(scale=canvas.size)[i + 1]) for i in range(len(points) - 1)]
    
    points_at_z = {}
    z_range = 20
    
    for line in lines:
        for z in range(z_range):
            z_val = z / z_range
            if z not in points_at_z:
                points_at_z[z] = []
                
            points_at_z[z] += line.getPointAtZ(z_val) or []
            print(f"At z={z_val}, line {line} has points: {line.getPointAtZ(z_val)}")

    colors = ["red", "green", "blue", "orange", "purple"]
    i = 0

    for z, pts in points_at_z.items():
        if len(pts) >= 3:
            print(f"At z={z}, found {len(pts)} points")
            p = Points(pts)
            
            print(p)
            hull = p.convex_hull()
      
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
    
    
