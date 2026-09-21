"""Reproduce metric road and building data from the archived OSM API response."""
from pathlib import Path
import xml.etree.ElementTree as ET
import json, hashlib

root = Path(__file__).resolve().parents[1] / 'public'
source = root / 'sources/neonadeuli-osm.xml'
tree = ET.parse(source).getroot()
nodes = {n.attrib['id']: {'id': n.attrib['id'], 'lat': float(n.attrib['lat']), 'lng': float(n.attrib['lon'])} for n in tree.findall('node')}
ways = []
for way in tree.findall('way'):
    tags = {t.attrib['k']: t.attrib['v'] for t in way.findall('tag')}
    if 'highway' not in tags and way.attrib['id'] != '843403989':
        continue
    ways.append({'id': way.attrib['id'], 'tags': tags, 'coordinates': [nodes[n.attrib['ref']] for n in way.findall('nd')]})
result = {'source': 'https://api.openstreetmap.org/api/0.6/map?bbox=127.1088,37.6175,127.1118,37.6187', 'license': '© OpenStreetMap contributors, ODbL 1.0', 'sha256': hashlib.sha256(source.read_bytes()).hexdigest(), 'dataTimestamp': tree.find('meta').attrib.get('osm_base') if tree.find('meta') is not None else None, 'ways': ways}
(root / 'generated/neonadeuli-context.json').write_text(json.dumps(result, ensure_ascii=False, indent=2) + '\n')
print(f'Extracted {len(ways)} real road/building ways')
