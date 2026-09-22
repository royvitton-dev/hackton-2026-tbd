const film=await fetch(new URL('../output/tour/manifest.json',import.meta.url)).then(r=>{if(!r.ok)throw new Error('Tour manifest unavailable');return r.json();});
const video=document.querySelector('video'),count=film.attractionIds.length;
document.title='Wonder Park · 모든 어트랙션과 GS 피날레';
document.querySelector('header .micro:last-child').textContent=`${film.duration} SECONDS · ${count} ATTRACTIONS`;
document.querySelector('.eyebrow').textContent='EVERY ATTRACTION · ONE GRAND FINALE';
document.querySelector('h1').innerHTML=`${count} wonders.<br>One <em>park.</em>`;
document.querySelector('.intro p').innerHTML=`<strong>${count}개의 모험, 하나의 빛나는 피날레.</strong><br>레이싱부터 주차 안내까지, 실제 기능을 만나보세요.<br>마지막은 성 위에 펼쳐지는 GS 폭죽입니다.`;
document.querySelector('.screen-bar span:first-child').textContent='✧  WONDER PARK / THE ATTRACTION TOUR';
document.querySelector('.screen-bar span:last-child').textContent=`ORIGINAL SCORE · 1080P · ${film.duration} SECONDS`;
video.poster=new URL('../output/tour/poster.png',import.meta.url).href;
video.src=new URL('../output/wonder-park-tour.mp4',import.meta.url).href;
video.querySelector('track').src=new URL('../output/tour/captions.vtt',import.meta.url).href;
video.load();
document.querySelector('.download').href=video.src;
let after=document.querySelector('.actions');
for(const chapter of film.chapters.filter(c=>c.segments?.length)){
 const moments=document.createElement('nav');moments.className='tour-moments';moments.dataset.attraction=chapter.id;moments.setAttribute('aria-label',chapter.name+' 장면 이동');
 const label=document.createElement('span');label.textContent=chapter.name;moments.append(label);
 for(const segment of chapter.segments){const button=document.createElement('button');button.className='moment';button.dataset.time=chapter.demoStart+segment.start;button.textContent=segment.name;button.addEventListener('click',()=>{video.currentTime=Number(button.dataset.time);video.play().catch(()=>{});});moments.append(button);}
 after.after(moments);after=moments;
}
const momentStyle=document.createElement('style');momentStyle.textContent='.tour-moments{display:flex;flex-wrap:wrap;align-items:center;gap:10px;margin:0 0 20px}.tour-moments>span{font-size:12px;color:var(--muted);margin-right:5px}.tour-moments button{font:inherit;font-size:12px;border:1px solid #b89b6166;border-radius:4px;padding:9px 13px;background:#172339;color:var(--gold);cursor:pointer}.tour-moments button:hover{background:#293b52}';document.head.append(momentStyle);
const nav=document.querySelector('.timeline');nav.replaceChildren();nav.classList.add('tour-timeline');
const buttons=film.chapters.map(chapter=>{
 const button=document.createElement('button');button.className='chapter';button.dataset.time=chapter.start;
 const seconds=chapter.start%60,stamp=document.createElement('small');stamp.textContent=`${String(Math.floor(chapter.start/60)).padStart(2,'0')}:${String(seconds).padStart(Number.isInteger(seconds)?2:4,'0')}`;
 const name=document.createElement('span');name.textContent=chapter.name;button.append(stamp,name);
 button.addEventListener('click',()=>{video.currentTime=chapter.start;video.play().catch(()=>{});});nav.append(button);return button;
});
const active=()=>{const current=buttons.findLast(b=>video.currentTime>=Number(b.dataset.time));buttons.forEach(b=>b.classList.toggle('active',b===current));};video.addEventListener('timeupdate',active);active();
document.querySelector('.note').textContent=`현재 파크에 등록된 ${count}개 어트랙션의 실제 3D 모델을 촬영했습니다. 실제 앱을 조작한 레이싱·시상식·커피차·영상 재생·배터리 투시와 충전 이력·3D 도면·주차면 진입·충전기 설치 후보 비교·핀볼·모의 거래 장면을 담았습니다. 주차는 공개 도면 기반 소형차 경로 미리보기, 충전 후보는 공개 기지국 기반 추정이며 화재 우회는 합성 시험장입니다. 음성 장면은 합성 음성 파일의 실제 인식 기록이며 명령 실행 전 연습 모드까지 보여줍니다. 마지막 10초에는 파크의 실제 GS 불꽃 입자가 솟아올라 글자를 만들고 흩어집니다.`;
document.querySelector('footer .micro:last-child').textContent='TBD WONDER PARK / EIGHT WONDERS, ONE PARK';
document.querySelector('.tour-banner')?.remove();
const style=document.createElement('style');style.textContent='.timeline.tour-timeline{grid-template-columns:repeat(5,minmax(0,1fr))}.tour-timeline .chapter{min-width:0}@media(max-width:700px){.timeline.tour-timeline{grid-template-columns:repeat(2,minmax(0,1fr))}header .brand{white-space:nowrap}header>.micro:nth-child(2){display:none}}';document.head.append(style);
document.body.dataset.film='attractions';
