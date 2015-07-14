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
grid_x = float(sys.argv[4])
grid_y = float(sys.argv[5])
grid_w = float(sys.argv[6])
grid_h = float(sys.argv[7])

img = cv2.imread(img_path)    
gray = cv2.cvtColor(img,cv2.COLOR_BGR2GRAY)    
gaussian = cv2.GaussianBlur(gray,(3,3),0)
ret, thresh = cv2.threshold(gaussian,127,255,cv2.THRESH_BINARY_INV)
thresh2 = cv2.bitwise_not(thresh)
contours,hierarchy = cv2.findContours(thresh, cv2.RETR_EXTERNAL, 1)
max_area = -1
max_cnt = None 
height, width = img.shape[1::-1]

# find contours with maximum area
for cnt in contours:
    approx = cv2.approxPolyDP(cnt, 0.02*cv2.arcLength(cnt,True), True)
    if len(approx) == 4:
        if cv2.contourArea(cnt) > max_area:
            x,y,w,h = cv2.boundingRect(cnt)
            if abs(x-grid_x) < 0.1*width and abs(y-grid_y) < 0.1*height and abs(w-grid_w) < 0.1*width and abs(h-grid_h) < 0.1*height:
                max_area = cv2.contourArea(cnt)
                max_cnt = cnt
                max_approx = approx

if max_cnt is None:
    cross_rect = thresh2[grid_y:grid_y+grid_h, grid_x:grid_x+grid_w]
    cross_rect = cv2.resize(cross_rect,(width_squares*10,height_squares*10))
    cross = np.zeros((width_squares,height_squares))

    for i in xrange(width_squares):
        for j in xrange(height_squares):
            box = cross_rect[i*10:(i+1)*10, j*10:(j+1)*10]
            white = cv2.countNonZero(box)
            if white > 50:
                cross.itemset((i,j),1)

    print('\n'.join([''.join(['{:4}'.format(item.astype(np.int64)) for item in row]) 
          for row in cross]))
else:
    iffy_rot = 0
    iffy_no_rot = 0
    cross_rot = np.zeros((width_squares,height_squares))
    cross_no_rot = np.zeros((width_squares,height_squares))

    # try accounting for rotation
    old_pts = max_approx.reshape(4,2).astype('float32')
    new_pts = np.zeros((4, 2), dtype = "float32")
    avg_x = 0.25*(old_pts[0][0] + old_pts[1][0] + old_pts[2][0] + old_pts[3][0])
    avg_y = 0.25*(old_pts[0][1] + old_pts[1][1] + old_pts[2][1] + old_pts[3][1])
    for i in xrange(4):
        if old_pts[i][0] < avg_x and old_pts[i][1] < avg_y:
            new_pts[i] = [0,0]
        elif old_pts[i][0] > avg_x and old_pts[i][1] < avg_y:
            new_pts[i] = [10*width_squares-1,0]
        elif old_pts[i][0] < avg_x and old_pts[i][1] > avg_y:
            new_pts[i] = [0,10*height_squares-1]
        else:
            new_pts[i] = [10*width_squares-1,10*height_squares-1]
    M = cv2.getPerspectiveTransform(old_pts,new_pts)
    cross_rect_rot = cv2.warpPerspective(thresh2,M,(10*width_squares,10*height_squares))

    for i in xrange(width_squares):
        for j in xrange(height_squares):
            box = cross_rect_rot[i*10:(i+1)*10, j*10:(j+1)*10]
            white = cv2.countNonZero(box)
            if white > 50:
                cross_rot.itemset((i,j),1)
            if white > 30 and white < 70:
                iffy_rot += 1

    # now try without rotation
    x,y,w,h = cv2.boundingRect(max_cnt)
    cross_rect_no_rot = thresh2[y:y+h, x:x+w]
    cross_rect_no_rot = cv2.resize(cross_rect_no_rot,(width_squares*10,height_squares*10))

    for i in xrange(width_squares):
        for j in xrange(height_squares):
            box = cross_rect_no_rot[i*10:(i+1)*10, j*10:(j+1)*10]
            white = cv2.countNonZero(box)
            if white > 50:
                cross_no_rot.itemset((i,j),1)
            if white > 30 and white < 70:
                iffy_no_rot += 1

    if iffy_rot < iffy_no_rot:
        print('\n'.join([''.join(['{:4}'.format(item.astype(np.int64)) for item in row]) 
              for row in cross_rot]))
    else:
        print('\n'.join([''.join(['{:4}'.format(item.astype(np.int64)) for item in row]) 
              for row in cross_no_rot]))