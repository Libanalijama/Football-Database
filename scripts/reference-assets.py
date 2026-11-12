"""Safely copy user-supplied PNG references into normalized reference-only paths.
Run with a Python environment containing Pillow; never executes content from archives.
"""
from pathlib import Path, PurePosixPath
import zipfile, hashlib, json, re, unicodedata
from PIL import Image, ImageOps, ImageDraw
ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'references'
PACKS = {
 'Personal Profiles': ('profiles', ['player','manager','owner','executive']),
 'Transfer Cards': ('transfers', ['announcement','fees','clubs','contract']),
 'Comparison Templates': ('comparisons', ['player','manager','season','finances','arguments']),
 'Statistics Card': ('statistics', ['player','match','finances','big-number']),
 'Timeline': ('timelines', ['player','manager','history']),
 'Scoreboard': ('scoreboards', ['result','scorers','details','cup']),
}
def fixed(s):
 try: s = s.encode('cp437').decode('utf8')
 except (UnicodeEncodeError, UnicodeDecodeError): pass
 return unicodedata.normalize('NFC', s)
def main():
 manifest=[]
 OUT.mkdir(exist_ok=True)
 for key,(family,slugs) in PACKS.items():
  archive=next(Path('/Volumes/PortableSSD').glob('TGIQ*'+key+'*.zip'))
  entries=[]
  with zipfile.ZipFile(archive) as z:
   for member in z.infolist():
    path=PurePosixPath(member.filename)
    if path.is_absolute() or '..' in path.parts: raise ValueError('Unsafe archive path')
    if member.is_dir() or '__MACOSX' in path.parts or any(p.startswith('._') for p in path.parts): continue
    if path.suffix.lower()!='.png': continue
    if member.file_size > 25_000_000: raise ValueError('Oversize reference')
    entries.append(member)
   if len(entries)!=len(slugs): raise ValueError(f'{family}: unexpected image count')
   for member,slug in zip(entries,slugs):
    data=z.read(member)
    folder=OUT/family;folder.mkdir(exist_ok=True)
    dest=folder/(slug+'.png');dest.write_bytes(data)
    with Image.open(dest) as image:
     image.verify()
    with Image.open(dest) as image:
     width,height=image.size
    manifest.append({'id':family+'.'+slug,'archive':archive.name,'originalArchivePath':member.filename,'normalizedOriginalName':fixed(PurePosixPath(member.filename).name),'path':str(dest.relative_to(ROOT)),'width':width,'height':height,'sha256':hashlib.sha256(data).hexdigest(),'usage':'Flattened visual reference only; not used as renderer background or independent text/portrait asset'})
  # Contact sheets retain all 24 distinct references for review.
  files=[OUT/family/(slug+'.png') for slug in slugs]
  portrait=family in ('profiles','transfers')
  tw,th=(300,534) if portrait else (640,360)
  cols=2 if portrait else 2
  rows=(len(files)+cols-1)//cols
  sheet=Image.new('RGB',(cols*(tw+20)+20,rows*(th+48)+20),'#dedfe5')
  draw=ImageDraw.Draw(sheet)
  for idx,file in enumerate(files):
   image=Image.open(file).convert('RGB');image.thumbnail((tw,th))
   x=20+(idx%cols)*(tw+20);y=20+(idx//cols)*(th+48)
   sheet.paste(image,(x,y));draw.text((x,y+th+8),family+'/'+file.stem,fill='#111111')
  sheet.save(OUT/(family+'-contact.jpg'),quality=93)
 (OUT/'manifest.json').write_text(json.dumps({'schemaVersion':1,'references':manifest},indent=2,ensure_ascii=False)+'\n')
 print(f'Extracted {len(manifest)} verified PNGs and 6 contact sheets')
if __name__=='__main__':main()
