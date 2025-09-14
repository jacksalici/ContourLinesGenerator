
import svg
from geometry import *
from canvas import *

DEPTH = 10

if __name__ == '__main__':
    
    points = Points.generate(10, randomize=True, seed=1, min_z=0.2)
    canvas = Canvas()
    
    for x, y, z in points.get_all(scale=canvas.size):
        
        canvas.add(svg.Circle(
                cx=x, cy=y, r=10,
                fill="black",
                fill_opacity=0
            ))
        
            
    point_per_z = {
        z: Points() for z in [z/20 for z in range(6, 20, 2)]
    }
        
    for line in [Line(points.get_all()[i], points.get_all()[i+1]) for i in range(len(points)-1)]:
        for z in point_per_z.keys():
            pt = line.getPointAtZ(z)
            if pt is not None:
                point_per_z[z].add(pt)    
                
        canvas.add(svg.Line(
            x1=line.start.x * canvas.width, y1=line.start.y * canvas.height,
            x2=line.end.x * canvas.width, y2=line.end.y * canvas.height,
            stroke="black",
            stroke_width=2,
            stroke_opacity=0.5
        ))
    
    for z, pts in point_per_z.items():
        for x, y, _ in pts.get_all(scale=canvas.size):
            canvas.add(svg.Circle(
                cx=x, cy=y, r=5,
                fill="red",
                #fill_opacity=z
            ))
        
        for line in [Line(pts.get_all()[i], pts.get_all()[i+1]) for i in range(len(pts)-1)]:
            canvas.add(svg.Line(
                x1=line.start.x * canvas.width, y1=line.start.y * canvas.height,
                x2=line.end.x * canvas.width, y2=line.end.y * canvas.height,
                stroke="blue",
                stroke_width=line.start.z * 30,
                stroke_opacity=line.start.z
            ))
            
            
       
    canvas.export()
    
    
