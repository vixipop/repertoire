# Builds the valley painting's textures from the photo: run inside public/valley/.
# mask.png: R sky, G wind (foliage sway), B hair. flow.png: R/G brush direction
# (cos/sin of twice the stroke angle, scaled by coherence), B detail.
# sky.jpg: the sky band with branches and trees painted out, for the drifting clouds.
import numpy as np, cv2
im = cv2.imread('photo.jpg'); H, W = im.shape[:2]
hsv = cv2.cvtColor(im, cv2.COLOR_BGR2HSV).astype(np.float32)
h, s, v = hsv[...,0]*2, hsv[...,1]/255, hsv[...,2]/255
b, g, r = [im[...,i].astype(np.float32)/255 for i in range(3)]
Y, X = np.mgrid[0:H, 0:W].astype(np.float32)
blue = (h>188)&(h<232)&(s>0.22)&(v>0.74)
white = (s<0.2)&(v>0.7)&(b>=r-0.03)
cut = np.where(X<100, 592, 600)
notsky = (v<0.5)|(((h<185)|(h>240))&(s>0.16))
vm = cv2.medianBlur((v*255).astype(np.uint8),9).astype(np.float32)/255
twig = ((vm-v)>0.05)&(v<0.64)
notsky = notsky|twig
sky = (~notsky)&((Y<525)|blue|white)&(Y<cut)
sky = cv2.morphologyEx(sky.astype(np.uint8), cv2.MORPH_OPEN, np.ones((2,2),np.uint8))
sky = cv2.morphologyEx(sky, cv2.MORPH_CLOSE, np.ones((2,2),np.uint8)).astype(np.float32)
# girl
girl_poly = np.array([(688,968),(785,968),(800,1035),(808,1075),(832,1105),(842,1175),(848,1245),(832,1290),(826,1360),(818,1500),(662,1500),(668,1330),(652,1285),(656,1200),(660,1110),(684,1078),(678,1020)], np.int32)
girl = np.zeros((H,W),np.uint8); cv2.fillPoly(girl,[girl_poly],1)
girlfar = cv2.dilate(girl, np.ones((25,25),np.uint8)).astype(np.float32)
nonsky = 1-sky
green = ((h>40)&(h<175)&(s>0.15)).astype(np.float32)
darkleaf = ((v<0.35)).astype(np.float32)
leafy = np.clip(green+darkleaf*0.7,0,1)
wind = np.zeros((H,W),np.float32)
branch = nonsky*(Y<545)*(X<700)
wind = np.maximum(wind, branch*np.clip(0.35+0.65*Y/545,0,1))
wind = np.maximum(wind, nonsky*(Y<480)*(X>=700)*0.65)
wind = np.maximum(wind, leafy*(X>=560)*(Y>=480)*(Y<1420)*0.55)
wind = np.maximum(wind, leafy*(X<560)*(Y>=690)*(Y<1360)*0.45*(1-((X<330)&(Y>950)&(s<0.25))))
grass = ((h>35)&(h<95)&(s>0.18)&(v>0.35)).astype(np.float32)
wind = np.maximum(wind, grass*(Y>=1250)*0.3)
wind = cv2.GaussianBlur(wind,(0,0),9)
wind *= 1-cv2.GaussianBlur(girlfar,(0,0),6)
# hair: dark pixels in head ellipse, weight grows toward the tips
hair = np.zeros((H,W),np.uint8); cv2.ellipse(hair,(738,1060),(70,112),0,0,360,1,-1)
hair = hair.astype(np.float32)*(v<0.33)
hair = cv2.dilate(hair,np.ones((5,5),np.uint8))*np.clip((Y-990)/170,0,1)
hair = cv2.GaussianBlur(hair,(0,0),4)
hw, hh = 562, 750
mask = np.dstack([cv2.resize(hair,(hw,hh),interpolation=cv2.INTER_AREA), cv2.resize(wind,(hw,hh),interpolation=cv2.INTER_AREA), cv2.resize(sky,(hw,hh),interpolation=cv2.INTER_AREA)])
cv2.imwrite('mask.png', np.clip(mask*255+0.5,0,255).astype(np.uint8))  # BGR → R=sky G=wind B=hair
# flow field
fw, fh = 375, 500
gray = cv2.cvtColor(cv2.resize(im,(fw,fh),interpolation=cv2.INTER_AREA),cv2.COLOR_BGR2GRAY).astype(np.float32)/255
gx = cv2.Sobel(gray,cv2.CV_32F,1,0,ksize=3); gy = cv2.Sobel(gray,cv2.CV_32F,0,1,ksize=3)
Jxx = cv2.GaussianBlur(gx*gx,(0,0),4); Jyy = cv2.GaussianBlur(gy*gy,(0,0),4); Jxy = cv2.GaussianBlur(gx*gy,(0,0),4)
tg = 0.5*np.arctan2(2*Jxy, Jxx-Jyy)
phi = tg+np.pi/2
tr = Jxx+Jyy; dd = np.sqrt((Jxx-Jyy)**2+4*Jxy**2)
coh = np.where(tr>1e-6, dd/(tr+1e-6), 0)
coh = np.clip(coh*np.clip(tr*60,0,1),0,1)
det = np.sqrt(gx*gx+gy*gy); det = cv2.GaussianBlur(det,(0,0),2); det = np.clip(det/np.percentile(det,96),0,1)
g2 = cv2.resize(girl.astype(np.float32),(fw,fh),interpolation=cv2.INTER_AREA)
det = np.maximum(det, cv2.GaussianBlur(g2,(0,0),2)*0.8)
flow = np.dstack([det, np.sin(2*phi)*coh*0.5+0.5, np.cos(2*phi)*coh*0.5+0.5])
cv2.imwrite('flow.png', np.clip(flow*255+0.5,0,255).astype(np.uint8))
# sky plate: top band with everything but sky painted over
ph = 640
top = cv2.resize(im[:ph], (W//2, ph//2), interpolation=cv2.INTER_AREA)
hole = cv2.resize(((1-sky[:ph])*255).astype(np.uint8),(W//2,ph//2))
hole = cv2.dilate((hole>25).astype(np.uint8)*255, np.ones((7,7),np.uint8))
plate = cv2.inpaint(top, hole, 9, cv2.INPAINT_TELEA)
pm = cv2.medianBlur(plate,7)
dark = (pm.astype(np.float32).mean(2)-plate.astype(np.float32).mean(2))>10
plate[dark] = pm[dark]
plate = cv2.GaussianBlur(plate,(0,0),0.6)
cv2.imwrite('sky.jpg', plate, [cv2.IMWRITE_JPEG_QUALITY, 86])
cv2.imwrite('photo-web.jpg', im, [cv2.IMWRITE_JPEG_QUALITY, 86])
print('ok')
