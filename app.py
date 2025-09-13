import cv2
import numpy as np

width = 1024
height = 1024
depth = 255

n_points = 300



points_array = np.random.random_sample((n_points, 3)) * np.array([width, height, depth])
points_array = points_array.astype(np.int32)

image = np.zeros((height, width), dtype=np.uint8)  # Create a white image

for point in points_array:
    x, y, z = point
    image[y, x] = z  # Set the pixel at (x, y) to white


iter = 3

for i in range(iter):
    # create circle
    image = np.clip(image * 255, 0, 255).astype(np.uint8)  # Scale and clip values to the range [0, 255]
    kernel_size =50
    kernel = cv2.getGaussianKernel(kernel_size, 0)
    kernel = kernel * kernel.T  # Create a 2D Gaussian kernel
    kernel = kernel / np.sum(kernel)  # Normalize the kernel

    image = cv2.filter2D(image, -1, kernel)


    # increse contrast


   

    
# Display the image
cv2.imshow('Image', image)
cv2.waitKey(0)
cv2.destroyAllWindows()

