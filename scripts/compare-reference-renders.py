"""Create labelled side-by-side visual QA sheets. Requires Pillow."""
from pathlib import Path
from PIL import Image,ImageDraw
import json
ROOT=Path(__file__).resolve().parents[1]
OUT=ROOT/'docs/screenshots/comparisons';OUT.mkdir(parents=True,exist_ok=True)
MAP={
'profiles.player':'profile-player','profiles.manager':'profile-manager','profiles.owner':'profile-owner','profiles.executive':'profile-executive',
'transfers.announcement':'transfer-announcement','transfers.fees':'transfer-fees','transfers.clubs':'transfer-clubs','transfers.contract':'transfer-contract',
'comparisons.player':'comparison-player','comparisons.manager':'comparison-manager','comparisons.season':'comparison-season','comparisons.finances':'comparison-finances','comparisons.arguments':'comparison-arguments',
'statistics.player':'statistics-player','statistics.match':'statistics-match','statistics.finances':'statistics-finances','statistics.big-number':'statistics-big-number',
'timelines.player':'timeline-player','timelines.manager':'timeline-manager','timelines.history':'timeline-history',
'scoreboards.result':'scoreboard-result','scoreboards.scorers':'scoreboard-scorers','scoreboards.details':'scoreboard-details','scoreboards.cup':'scoreboard-cup'}
manifest=json.loads((ROOT/'references/manifest.json').read_text())
for ref in manifest['references']:
 id=MAP[ref['id']]
 source=Image.open(ROOT/ref['path']).convert('RGB')
 actual=Image.open(ROOT/'docs/screenshots/templates'/f'{id}.png').convert('RGBA')
 if ref['width']<ref['height']:
  actual=actual.crop((72,49,625,1031));size=actual.size
 else:size=(1920,1080)
 source=source.resize(size,Image.Resampling.LANCZOS)
 sheet=Image.new('RGB',(size[0]*2+24,size[1]+50),'#d9dee5');draw=ImageDraw.Draw(sheet)
 sheet.paste(source,(0,50));bg=Image.new('RGBA',size,'#061328');bg.paste(actual,(0,0),actual);sheet.paste(bg.convert('RGB'),(size[0]+24,50))
 draw.text((12,17),'SUPPLIED FLATTENED REFERENCE',fill='#09182b');draw.text((size[0]+36,17),'REBUILT LIVE COMPONENT · VISUAL QA FIXTURE',fill='#09182b')
 sheet.save(OUT/f'{id}.jpg',quality=91)
files=sorted((ROOT/'docs/screenshots/templates').glob('*.png'))
sheet=Image.new('RGB',(2000,((len(files)+3)//4)*312),'#ddd');d=ImageDraw.Draw(sheet)
for i,file in enumerate(files):
 im=Image.open(file).convert('RGBA');im.thumbnail((480,270));bg=Image.new('RGBA',(480,270),'#768392');bg.paste(im,(0,0),im)
 x=(i%4)*500+10;y=(i//4)*312+10;sheet.paste(bg.convert('RGB'),(x,y));d.text((x,y+278),file.stem,fill='#111')
sheet.save(ROOT/'docs/screenshots/graphics-overview.jpg',quality=94)
print(f'Created {len(MAP)} reference comparisons and all-template overview')
