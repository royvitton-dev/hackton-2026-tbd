"""Extract 20 small OSM snapshots from the public Geofabrik country PBF.
Requires osmium==4.3.1 in a dedicated environment. No OSM editing API calls.
"""
import sys, json, math, hashlib
from pathlib import Path
from datetime import datetime, timezone
import osmium
root=Path(__file__).resolve().parents[1]
pbf=Path(sys.argv[1]) if len(sys.argv)>1 else root/'.runtime/south-korea-260920.osm.pbf'
regions=json.loads((root/'scripts/map-regions.json').read_text())
source_url=sys.argv[2] if len(sys.argv)>2 else 'https://download.geofabrik.de/asia/south-korea-260920.osm.pbf'
if len(sys.argv)>1 and len(sys.argv)<3:raise ValueError('Provide the source URL alongside a custom PBF path')
with osmium.io.Reader(str(pbf)) as reader:
    timestamp=reader.header().get('osmosis_replication_timestamp')
assert timestamp, 'OSM snapshot timestamp required'
sha=hashlib.file_digest(pbf.open('rb'),'sha256').hexdigest()
stores=[]
for r in regions:
    lng,lat=r['center'];dy=.0065;dx=dy/math.cos(math.radians(lat))
    stores.append({'region':r,'bbox':[round(lat-dy,7),round(lng-dx,7),round(lat+dy,7),round(lng+dx,7)],'nodes':{},'ways':{},'relations':[]})
def inside(p,b):return b[1]<=p[0]<=b[3] and b[0]<=p[1]<=b[2]
barriers={};seen=0
processor=osmium.FileProcessor(str(pbf)).with_locations().with_filter(osmium.filter.KeyFilter('highway','building','amenity','barrier','type'))
for obj in processor:
    tags=dict(obj.tags)
    if obj.is_node():
        if 'barrier' in tags:barriers[obj.id]=tags
        if tags.get('amenity')!='charging_station':continue
        for store in stores:
            if inside((obj.lon,obj.lat),store['bbox']):store['nodes'][obj.id]={'type':'node','id':obj.id,'lat':obj.lat,'lon':obj.lon,'tags':tags}
    elif obj.is_way():
        if not ('highway' in tags or 'building' in tags or tags.get('amenity')=='charging_station'):continue
        coords=[(n.ref,n.lon,n.lat) for n in obj.nodes if n.location.valid()]
        if len(coords)<2:continue
        west=min(p[1] for p in coords);east=max(p[1] for p in coords);south=min(p[2] for p in coords);north=max(p[2] for p in coords)
        for store in stores:
            s,w,n,e=store['bbox']
            if west>e or east<w or south>n or north<s:continue
            store['ways'][obj.id]={'type':'way','id':obj.id,'nodes':[p[0] for p in coords],'tags':tags,'center':{'lon':(west+east)/2,'lat':(south+north)/2}}
            for ref,lon,lat in coords:
                if ref not in store['nodes']:store['nodes'][ref]={'type':'node','id':ref,'lon':lon,'lat':lat,'tags':barriers.get(ref,{})}
        seen+=1
        if seen%200000==0:print(f'Processed {seen:,} roads/buildings',flush=True)
    elif obj.is_relation() and tags.get('type')=='restriction':
        members=[{'type':{'n':'node','w':'way','r':'relation'}[m.type],'role':m.role,'ref':m.ref} for m in obj.members]
        for store in stores:
            if any(m['type']=='way' and m['ref'] in store['ways'] for m in members):store['relations'].append({'type':'relation','id':obj.id,'tags':tags,'members':members})
output=root/'public/mobility/maps/raw';output.mkdir(parents=True,exist_ok=True)
for store in stores:
    region=store['region'];elements=list(store['nodes'].values())+list(store['ways'].values())+store['relations']
    raw={'version':.6,'generator':'ATLAS / pyosmium 4.3.1 local Geofabrik extract','osm3s':{'timestamp_osm_base':timestamp,'copyright':'© OpenStreetMap contributors, ODbL-1.0'},'bounds':store['bbox'],'elements':elements}
    blob=json.dumps(raw,ensure_ascii=False,separators=(',',':')).encode();(output/f"{region['id']}.json").write_bytes(blob)
    source={'endpoint':source_url,'query':'Local bounding-box extraction: highways, buildings, charging_station, barriers and related turn restrictions','bbox':store['bbox'],'fetchedAt':datetime.now(timezone.utc).isoformat(),'sha256':hashlib.sha256(blob).hexdigest(),'sourcePbfSha256':sha,'extractor':'pyosmium 4.3.1'}
    (output/f"{region['id']}.source.json").write_text(json.dumps(source,ensure_ascii=False,indent=2))
    print(region['id'],len(elements),'elements',len(blob),'bytes',flush=True)
print('20 local snapshots extracted',flush=True)
