// Manually reviewed against the linked publisher photographs. Dimensions outside
// a published footprint are proportions for a visual study, not a survey.
const patch = (file, size, corners, span) => ({file, quad:corners.map(([x,y])=>[x/size[0],y/size[1]]), span});
const neon='photos/neonadeuli-exterior.jpg';
const onum='address/photos/20000441-0.jpg';

export const FACADES = {
  '10000901': {
    type:'neonadeuli', width:63.2, depth:10.5, floors:5, floorHeight:2.8, baseHeight:4, color:'#d5d4c3', baseColor:'#41494a',
    features:['흰색 상부·회색 하부 패널','노란 입면 포인트','검은 돌출 난간','필로티와 어두운 벽돌 기단','옥상 난간'],
    photoFiles:[neon],
    materials:{
      upper:{kind:'panel',color:'#d5d4c3',span:[1.8,.6],photo:patch(neon,[1804,1238],[[276,369],[286,366],[286,373],[276,376]],[.3,.24])},
      lower:{kind:'panel',color:'#939292',span:[1.8,.6],photo:patch(neon,[1804,1238],[[216,708],[241,703],[240,716],[215,721]],[.85,.45])},
      base:{kind:'brick',color:'#41494a',span:[1.3,.6],photo:patch(neon,[1804,1238],[[345,927],[386,920],[385,961],[343,968]],[.95,.75])},
    },
  },
  '20000441': {
    type:'onum', width:13.2, depth:15.8, floors:5, floorHeight:2.85, baseHeight:3.2, color:'#bc603b', baseColor:'#bcb8ac',
    features:['붉은 장벽돌','층마다 다른 창 배치','돌출 코너 창·반투명 난간','열린 주차층','박공과 옥상 테라스'],
    photoFiles:[onum,'address/photos/20000441-1.jpg'],
    materials:{brick:{kind:'brick',color:'#bc603b',span:[1.3,.56],photo:patch('address/photos/20000441-1.jpg',[1920,1280],[[887,582],[940,596],[940,640],[887,625]],[1.6,.9])}},
  },
  '20000555': {
    type:'urban', width:14.4, depth:9.6, floors:5, floorHeight:2.85, baseHeight:3.0, color:'#a77562', baseColor:'#706d67',
    features:['적갈색 벽돌 줄눈','검은 깊은 창틀','낮아지는 우측 매스','필로티 기둥과 주차 구획'],
    photoFiles:['address/photos/20000555-0.png'],
    materials:{brick:{kind:'brick',color:'#a77562',span:[1.3,.6],photo:patch('address/photos/20000555-0.png',[1080,1080],[[372,681],[417,690],[417,757],[367,749]],[.9,1.05])}},
  },
  '20000474': {
    type:'saneunjari', width:11.4, depth:11.8, floors:5, floorHeight:2.85, baseHeight:3.0, color:'#e0e1d8', baseColor:'#41484b',
    features:['미세한 흰색 미장','크기가 다른 창','측면 철제 발코니','꺾인 옥상 윤곽'],
    photoFiles:['address/photos/20000474-0.jpg'],
    materials:{upper:{kind:'plaster',color:'#e0e1d8',span:[1,1],photo:patch('address/photos/20000474-0.jpg',[1920,1280],[[771,552],[826,544],[827,594],[771,602]],[1.1,.9])}},
  },
  '20000536': {
    type:'amsa', width:10.8, depth:13.8, floors:5, floorHeight:2.8, baseHeight:3.2, color:'#b8b8b3', baseColor:'#9b9d94',
    features:['밝은 석재와 회색 창 주변 띠','실제 사진의 석재 질감','세 가지 폭의 창','난간·배관·열린 필로티'],
    photoFiles:['address/photos/20000536-0.jpg'],
    materials:{
      upper:{kind:'stone',color:'#b8b8b3',span:[1.2,.6],photo:patch('address/photos/20000536-0.jpg',[716,862],[[175,536],[184,535],[183,550],[173,551]],[.25,.34])},
      lower:{kind:'stone',color:'#777e84',span:[1.2,.6],photo:patch('address/photos/20000536-0.jpg',[716,862],[[480,550],[501,547],[502,564],[480,567]],[.4,.35])},
    },
  },
  '10002042': {
    type:'koinonia', width:16, depth:17, floors:6, floorHeight:3, baseHeight:3.2, color:'#a5a4a0', baseColor:'#66666a',
    features:['회색 장벽돌·수평 띠','곡선 저층부와 세로 루버','8열의 긴 창','따뜻한 실내광·옥상 테라스'],
    photoFiles:['address/photos/10002042-0.jpg','address/photos/10002042-1.jpg'],
    materials:{brick:{kind:'brick',color:'#a5a4a0',span:[1.8,.6],photo:patch('address/photos/10002042-0.jpg',[1067,1600],[[650,700],[672,700],[672,761],[650,761]],[.36,1.05])}},
  },
};

export function facadeFor(site) { return FACADES[site.siteId || site.id?.replace(/-\d+$/,'')] || null; }

// This photo says “전경”, but it is a kitchen/living room, not an exterior.
export function isExteriorPhoto(photo) {
  return photo?.file !== 'address/photos/10000901-1.jpg'
    && !/주방|거실|내부|실내|평면/.test(photo?.alt || '')
    && photo?.reviewStatus !== 'excluded-interior';
}

// Square-to-quad homography: photo perspective is removed on the GPU, while
// source pixels and files remain intact. Coordinates use a top-left origin.
export function photoHomography(q) {
  const [[x0,y0],[x1,y1],[x2,y2],[x3,y3]]=q;
  const dx1=x1-x2, dx2=x3-x2, dx3=x0-x1+x2-x3;
  const dy1=y1-y2, dy2=y3-y2, dy3=y0-y1+y2-y3;
  const det=dx1*dy2-dx2*dy1;
  const g=Math.abs(det)<1e-12?0:(dx3*dy2-dx2*dy3)/det;
  const h=Math.abs(det)<1e-12?0:(dx1*dy3-dx3*dy1)/det;
  return [x1-x0+g*x1,x3-x0+h*x3,x0, y1-y0+g*y1,y3-y0+h*y3,y0, g,h,1];
}
