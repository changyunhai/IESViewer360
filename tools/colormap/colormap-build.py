# build false color color map from bmp file to json file,

import cv2, json

def build(infile: str, outfile: str):
    image = cv2.imread(infile, cv2.IMREAD_UNCHANGED)
    height, width = image.shape[:2]
    pixels = []
    for i in range(0, width):
        (b, g, r) = image[round(height/2), i]
        pixels.append([round(r / 255.0, 3), round(g / 255.0, 3), round(b / 255.0, 3)])
    with open(outfile, 'w') as f:
        json.dump(pixels, f, indent=4)
    pass



build('gradient-2.bmp','../../src/util/colormap-gradient.json')
build('solid-3.bmp','../../src/util/colormap-solid.json')
build('grayscale.bmp','../../src/util/colormap-grayscale.json')

