"""Read public restaurant websites; collect evidence candidates, never auto-publish labels.
Usage: python3 scripts/research/restaurant-websites.py CATALOG_JSON OUTPUT_DIR
No API keys. Bounded, cached requests; robots honored; public HTTP(S) only.
"""
import concurrent.futures, datetime, hashlib, ipaddress, json, pathlib, re, socket, sys, threading, time
from html.parser import HTMLParser
from urllib.parse import urlsplit, urljoin
from urllib.robotparser import RobotFileParser
import requests

AGENT = 'TabletalkResearch/1.0'
MAX_BYTES = 1500000
class Page(HTMLParser):
    def __init__(self):
        super().__init__(); self.hidden=0; self.words=[]; self.links=[]; self.href=None; self.anchor=[]
    def handle_starttag(self,tag,attrs):
        a=dict(attrs)
        if tag in ('script','style','noscript','svg'): self.hidden+=1
        if tag=='a': self.href=a.get('href'); self.anchor=[]
        if tag=='meta' and a.get('name','').lower()=='description': self.words.append(a.get('content',''))
    def handle_endtag(self,tag):
        if tag in ('script','style','noscript','svg'): self.hidden=max(0,self.hidden-1)
        if tag=='a' and self.href: self.links.append((self.href,' '.join(self.anchor)));self.href=None
    def handle_data(self,data):
        if not self.hidden:
            clean=' '.join(data.split())
            if clean: self.words.append(clean)
            if self.href:self.anchor.append(clean)
def public(url):
    p=urlsplit(url)
    if p.scheme not in ('https','http') or not p.hostname or p.username or p.password or p.port not in (None,80,443): raise ValueError('Unsupported URL')
    for a in socket.getaddrinfo(p.hostname,p.port or (443 if p.scheme=='https' else 80)):
        if not ipaddress.ip_address(a[4][0]).is_global: raise ValueError('Non-public host')
    return p

def allowed(url):
    base=public(url);robots=RobotFileParser()
    try:
        _,body=fetch(f'{base.scheme}://{base.netloc}/robots.txt',check_robots=False)
        robots.parse(body.splitlines())
    except requests.HTTPError as e:
        if e.response.status_code not in (404,410):raise ValueError('Robots unavailable')
        robots.parse([])
    if not robots.can_fetch(AGENT,url):raise ValueError('Robots disallow')

def fetch(url,check_robots=True):
    for _ in range(4):
        public(url)
        # Recheck at redirect destinations, including a different host.
        if check_robots:allowed(url)
        with requests.get(url,headers={'User-Agent':AGENT,'Accept':'text/html,text/plain'},timeout=(5,10),allow_redirects=False,stream=True) as r:
            if r.is_redirect:url=urljoin(url,r.headers.get('Location',''));continue
            r.raise_for_status()
            if not any(x in r.headers.get('Content-Type','') for x in ('text/html','text/plain','application/xhtml')):raise ValueError('Not HTML/text')
            raw=b''
            for block in r.iter_content(32768):
                raw+=block
                if len(raw)>MAX_BYTES:raise ValueError('Page too large')
            encoding=r.encoding if 'charset=' in r.headers.get('Content-Type','').lower() else 'utf-8'
            return url,raw.decode(encoding or 'utf-8',errors='replace')
    raise ValueError('Too many redirects')

PATTERNS={
 'Brunch':r'\bbrunch\b',
 # Broad candidate discovery only: reviewers must reject biographies, dress codes,
 # diet exclusions, menu legends, catering-only offers and mismatched branches.
 'Good for groups':r'\b(?:private dining|private parties|large.part\w*|large groups?|group dining|group reservations|parties of|groups of)\b',
 'Date night':r'\b(?:date nights?|romantic|intimate|candlelit|candle-lit)\b',
 'Casual':r'\b(?:casual(?:ly)?|neighborhood hangout|laid-back|laid back|counter service|fast casual|fast-casual)\b',
 'Vegetarian':r'\b(?:vegan|vegetarian|plant-based|plant based)\b',
}

def run(group,out):
    website,venues=group;key=hashlib.sha256(website.encode()).hexdigest()[:20];path=out/(key+'.json')
    if path.exists():return json.loads(path.read_text())
    result={'website':website,'venues':[{'id':v['id'],'name':v['name'],'address':v['address']} for v in venues], 'checkedAt':datetime.datetime.now(datetime.timezone.utc).isoformat(),'pages':[],'status':'unreadable'}
    try:
        base=public(website); robots=RobotFileParser();robots_url=f'{base.scheme}://{base.netloc}/robots.txt'
        try:
            _,body=fetch(robots_url,check_robots=False);robots.parse(body.splitlines())
        except requests.HTTPError as e:
            if e.response.status_code in (401,403):raise ValueError('Robots inaccessible')
            if e.response.status_code not in (404,410):raise ValueError('Robots unavailable')
            robots.parse([])
        if not robots.can_fetch(AGENT,website):raise ValueError('Robots disallow')
        target,html=fetch(website);p=Page();p.feed(html);pending=[(target,p)];done=set()
        # Follow at most two same-host, relevant HTML pages. Keep branch matching for human review.
        candidates=[]
        for href,label in p.links:
            u=urljoin(target,href).split('#')[0]
            if urlsplit(u).hostname!=urlsplit(target).hostname or u==target:continue
            if re.search(r'\.(?:pdf|png|jpg|webp|svg)(?:\?|$)',u,re.I):continue
            if re.search(r'brunch|menus?|groups?|large.part|about',u+' '+label,re.I) and u not in candidates:candidates.append(u)
        for u in candidates[:2]:
            if robots.can_fetch(AGENT,u):
                try:
                    time.sleep(.3);dest,body=fetch(u);sub=Page();sub.feed(body);pending.append((dest,sub))
                except Exception:pass
        for u,page in pending:
            if u in done:continue
            done.add(u);text=' '.join(page.words);hits={}
            for tag,pattern in PATTERNS.items():
                matches=list(re.finditer(pattern,text,re.I))
                if matches:hits[tag]=[text[max(0,m.start()-110):m.end()+180] for m in matches[:4]]
            result['pages'].append({'url':u,'candidates':hits,'text':text[:50000]})
        result['status']='read'
    except Exception as e:result['error']=type(e).__name__+': '+str(e)[:120]
    path.write_text(json.dumps(result,ensure_ascii=False,indent=2));return result

if __name__=='__main__':
    catalog=json.loads(pathlib.Path(sys.argv[1]).read_text())['venues'];out=pathlib.Path(sys.argv[2]);out.mkdir(parents=True,exist_ok=True);groups={}
    for v in catalog:
        if v['website']:groups.setdefault(v['website'],[]).append(v)
    results=[]
    with concurrent.futures.ThreadPoolExecutor(max_workers=6) as pool:
        for result in pool.map(lambda item:run(item,out),groups.items()):
            results.append(result)
            if len(results)%25==0:print(json.dumps({'checked':len(results),'total':len(groups),'read':sum(r['status']=='read' for r in results)}),flush=True)
    summary={'checkedAt':datetime.datetime.now(datetime.timezone.utc).isoformat(),'venues':len(catalog),'websites':len(groups),'read':sum(r['status']=='read' for r in results),'missingWebsite':[v['id'] for v in catalog if not v['website']]}
    (out/'summary.json').write_text(json.dumps(summary,indent=2));print(json.dumps(summary),flush=True)
