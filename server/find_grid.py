# Example Usage: 
#  python find_grid.py puzzles/basic.jpg 21 21
#  from http://stackoverflow.com/questions/16975556/crossword-digitization-using-image-processing
import cv2
import numpy as np
import math
import sys

img_path = sys.argv[1] # first parameter is image path
width_squares = int(sys.argv[2]) # second parameter is number of squares wide the puzzle is
height_squares = int(sys.argv[3]) # third parameter is the number of squares tall the puzzle is

img = cv2.imread(img_path)    
gray = cv2.cvtColor(img,cv2.COLOR_BGR2GRAY)    
ret, thresh = cv2.threshold(gray,127,255,cv2.THRESH_BINARY_INV)
thresh2 = cv2.bitwise_not(thresh)

contours,hierarchy = cv2.findContours(thresh, cv2.RETR_EXTERNAL, 1)

max_area = -1

# find contours with maximum area
for cnt in contours:
    approx = cv2.approxPolyDP(cnt, 0.02*cv2.arcLength(cnt,True), True)
    if len(approx) == 4:
        if cv2.contourArea(cnt) > max_area:
            max_area = cv2.contourArea(cnt)
            max_cnt = cnt
            max_approx = approx

# cut the crossword region, and resize it to a standard size of 130x130
x,y,w,h = cv2.boundingRect(max_cnt)
cross_rect = thresh2[y:y+h, x:x+w]
cross_rect = cv2.resize(cross_rect,(width_squares*10,height_squares*10))

cross = np.zeros((width_squares,height_squares))

# select each box, if number of white pixels is more than 50, it is white box
for i in xrange(width_squares):
    for j in xrange(height_squares):
        box = cross_rect[i*10:(i+1)*10, j*10:(j+1)*10]
        if cv2.countNonZero(box) > 50:
            cross.itemset((i,j),1)

print('\n'.join([''.join(['{:4}'.format(item.astype(np.int64)) for item in row]) 
      for row in cross]))