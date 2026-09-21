import './entry.css';

export async function mountMobilityEntry({loadLab,showCharging}){
 const link=document.createElement('a');link.href='/mobility.html';link.className='nav mobility-nav';link.textContent='실차·충전 데이터';
 document.querySelector('.header nav').append(link);
 const workspace=new URLSearchParams(location.search).get('workspace');
 if(workspace==='source-drive')await loadLab('changdong');
 if(workspace==='source-charging'){await loadLab('changdong');await showCharging();}
}
