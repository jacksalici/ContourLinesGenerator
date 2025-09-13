import svg
def export(svg_content: svg.SVG, filename: str):
    with open(filename, "w") as f:
        f.write(svg_content.as_str())