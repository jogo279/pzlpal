# Example Usage: python clean_image.py in.jpg out.jpg
import cv2
import numpy as np
import math
import sys

img_path = sys.argv[1] # first parameter is image path


# Clean
img = cv2.imread(img_path)
gray = cv2.cvtColor(img,cv2.COLOR_BGR2GRAY)
gaussian = cv2.GaussianBlur(gray,(3,3),0)
# was: 120, 160, 120!!!
ret, thresh = cv2.threshold(gaussian,120,255,cv2.THRESH_BINARY_INV)
thresh2 = cv2.bitwise_not(thresh)

# Create image
cv2.imwrite(sys.argv[2],thresh2)