#!/usr/bin/env python3
"""Build editable Excalidraw + faithful SVG + offline HTML from board-content.json.

Uses only Python's standard library. This is a diagram generator, not an
assessment engine. Source content and research are supplied by the author.
"""
from __future__ import annotations

import hashlib
import html
import json
from pathlib import Path
import re
import sys
from xml.etree import ElementTree as ET

ROOT = Path(__file__).resolve().parent
PANEL_W = 1100
GAP = 64
MARGIN = 48
TOP = 300
FONT = 20
INK = '#163047'
MUTED = '#536779'
COLORS = {
    'Evidencia': ('#eaf5f0', '#247458'),
    'Propuesta': ('#edf3fc', '#315f9c'),
    'Por validar': ('#fff5de', '#947012'),
}


def ident(s):
    return 'cp_' + hashlib.sha256(s.encode()).hexdigest()[:20]


def numbered(title, index, panel=False):
    title = str(title or '')
    if re.match(r'^\s*\d+\s*(?:[.·:)]|[-–—])', title):
        return title
    return f'{index:02d}  {title}' if panel else f'{index}. {title}'


def width(text, font):
    """Conservative Helvetica-compatible character width, no network fonts."""
    total = 0
    for ch in text:
        if ch in 'ilI.,:;!|\'`': total += .28
        elif ch in 'MW@%': total += .89
        elif ch in 'mw': total += .82
        elif ch.isspace(): total += .30
        elif ch.isupper(): total += .69
        else: total += .56
    return total * font


def wrap(text, available, font):
    lines = []
    for paragraph in str(text or '').split('\n'):
        if not paragraph:
            lines.append('')
            continue
        current = ''
        for word in paragraph.split():
            candidate = (current + ' ' + word).strip()
            if current and width(candidate, font) > available:
                lines.append(current)
                current = word
            else:
                current = candidate
            while width(current, font) > available:
                cut = len(current)
                while cut > 1 and width(current[:cut], font) > available:
                    cut -= 1
                lines.append(current[:cut])
                current = current[cut:]
        lines.append(current)
    return lines or ['']


class Board:
    def __init__(self, content):
        self.content = content
        self.elements = []
        self.svg = []
        self.bounds = []
        self.sources = {str(s['id']): s for s in content.get('sources', [])}
        self.unknown_sources = set()

    def base(self, key, kind, x, y, w, h, stroke=INK, fill='transparent', frame=None):
        e = dict(id=ident(key), type=kind, x=x, y=y, width=w, height=h,
                 angle=0, strokeColor=stroke, backgroundColor=fill,
                 fillStyle='solid', strokeWidth=1.5, strokeStyle='solid',
                 roughness=0, opacity=100, groupIds=[], frameId=frame,
                 index=None, roundness=None, seed=int(hashlib.sha1(key.encode()).hexdigest()[:7],16),
                 version=1, versionNonce=1, isDeleted=False, boundElements=None,
                 updated=0, created=None, link=None, locked=False)
        self.elements.append(e)
        return e

    def rect(self, key, x, y, w, h, fill, stroke='#d8e2e9', frame=None, radius=14, link=None):
        e = self.base(key, 'rectangle', x,y,w,h,stroke,fill,frame)
        e['roundness'] = {'type':3} if radius else None
        e['link'] = link
        tag = f'<rect x="{x}" y="{y}" width="{w}" height="{h}" rx="{radius}" fill="{fill}" stroke="{stroke}" stroke-width="1.5"/>'
        self.svg.append(f'<a href="{html.escape(link,quote=True)}" target="_blank" rel="noopener">{tag}</a>' if link else tag)
        return e

    def text(self, key, text, x,y,w, font=FONT, color=INK, frame=None, link=None):
        lines = wrap(text,w,font)
        h = len(lines)*font*1.25
        e = self.base(key,'text',x,y,w,h,color,frame=frame)
        e.update(fontSize=font,fontFamily=2,text='\n'.join(lines),originalText='\n'.join(lines),
                 textAlign='left',verticalAlign='top',containerId=None,
                 autoResize=False,lineHeight=1.25,baseline=font,link=link)
        chunks = ''.join(f'<tspan x="{x}" y="{y+font+i*font*1.25}">{html.escape(line)}</tspan>' for i,line in enumerate(lines))
        tag = f'<text fill="{color}" font-family="Helvetica, Arial, sans-serif" font-size="{font}" style="white-space:pre">{chunks}</text>'
        self.svg.append(f'<a href="{html.escape(link,quote=True)}" target="_blank" rel="noopener">{tag}</a>' if link else tag)
        return h

    def arrow(self,key,points,frame=None):
        x,y = points[0]
        rel = [[px-x,py-y] for px,py in points]
        w=max(p[0] for p in points)-min(p[0] for p in points)
        h=max(p[1] for p in points)-min(p[1] for p in points)
        e=self.base(key,'arrow',x,y,w,h,'#6a8094',frame=frame)
        e.update(points=rel,lastCommittedPoint=None,startBinding=None,endBinding=None,
                 startArrowhead=None,endArrowhead='arrow',elbowed=False)
        coordinates=' '.join(f'{px},{py}' for px,py in points)
        self.svg.append(f'<polyline points="{coordinates}" fill="none" stroke="#6a8094" stroke-width="2" marker-end="url(#arrow)"/>')

    def badge(self,key,label,x,y,frame=None,link=None):
        bg,fg=COLORS.get(label,('#edf1f5','#536779'))
        w=max(48,width(label,17)+24)
        self.rect(key+'box',x,y,w,30,bg,stroke=bg,frame=frame,radius=6,link=link)
        self.text(key+'text',label,x+12,y+4,w-20,font=17,color=fg,frame=frame,link=link)
        return w

    def measure_panel(self,p):
        blocks=p.get('blocks',[])
        cw=(PANEL_W-80-40)/2
        measures=[]
        for bi,b in enumerate(blocks):
            label=numbered(b.get('title',''),bi+1) if p.get('flow') else b.get('title','')
            titleh=len(wrap(label,cw-40,23))*28.75
            bodyh=len(wrap(b.get('body',''),cw-40,FONT))*25
            source_rows=max(1,(len(b.get('sourceIds',[]))+5)//6) if b.get('sourceIds') else 0
            h=24+titleh+12+bodyh+18+34+source_rows*36+18
            measures.append(max(190,h))
        rows=[max(measures[i:i+2]) for i in range(0,len(measures),2)]
        th=len(wrap(p.get('title',''),PANEL_W-100,32))*40
        sh=len(wrap(p.get('subtitle',''),PANEL_W-100,20))*25
        start=36+th+12+sh+50
        return max(850,start+sum(rows)+max(0,len(rows)-1)*48+54),start,cw,rows

    def panel(self,p,i,x,y,layout):
        height,start,cw,rows=layout
        pid=str(p.get('id',f'panel-{i+1}'))
        fid=ident(pid+'frame')
        frame=self.base(pid+'frame','frame',x,y,PANEL_W,height,'#c5d4df','#ffffff')
        panel_title=numbered(p.get('title',''),i+1,panel=True)
        frame.update(name=panel_title,frameId=None)
        self.bounds.append(dict(id=pid,title=panel_title,x=x,y=y,w=PANEL_W,h=height))
        self.svg.append(f'<g data-panel="{html.escape(pid,quote=True)}" aria-label="{html.escape(p.get("title",""),quote=True)}">')
        self.rect(pid+'background',x,y,PANEL_W,height,'#ffffff','#c5d4df',fid,radius=20)
        self.text(pid+'title',panel_title,x+40,y+32,PANEL_W-80,font=32,frame=fid)
        th=len(wrap(panel_title,PANEL_W-80,32))*40
        self.text(pid+'subtitle',p.get('subtitle',''),x+40,y+32+th+12,PANEL_W-80,20,MUTED,fid)
        positions=[]
        cursor=y+start
        blocks=p.get('blocks',[])
        for row,rh in enumerate(rows):
            for col in range(2):
                n=row*2+col
                if n>=len(blocks): break
                actualcol=1-col if p.get('flow') and row%2 else col
                bx=x+40+actualcol*(cw+40)
                positions.append((bx,cursor,cw,rh))
                b=blocks[n]
                k=f'{pid}-block-{n}'
                status=b.get('status',p.get('status','Propuesta'))
                _,fg=COLORS.get(status,COLORS['Propuesta'])
                self.rect(k,bx,cursor,cw,rh,'#fbfcfe',frame=fid)
                self.rect(k+'accent',bx,cursor,5,rh,fg,fg,fid,radius=0)
                label=numbered(b.get('title',''),n+1) if p.get('flow') else b.get('title','')
                titleh=self.text(k+'title',label,bx+20,cursor+20,cw-40,23,INK,fid)
                bodyh=self.text(k+'body',b.get('body',''),bx+20,cursor+20+titleh+12,cw-40,FONT,INK,fid)
                by=cursor+20+titleh+12+bodyh+18
                self.badge(k+'status',status,bx+20,by,fid)
                sy=by+38
                sx=bx+20
                for j,sid in enumerate(b.get('sourceIds',[])):
                    sid=str(sid)
                    source=self.sources.get(sid)
                    if not source:self.unknown_sources.add(sid)
                    label=f'[{sid}]'
                    sw=max(48,width(label,17)+24)
                    if sx+sw>bx+cw-15:sx=bx+20;sy+=36
                    self.badge(k+'source'+str(j),label,sx,sy,fid,source.get('url') if source else None)
                    sx+=sw+8
            cursor+=rh+48
        if p.get('flow'):
            for n in range(len(positions)-1):
                a,b=positions[n],positions[n+1]
                ax,ay,aw,ah=a;bx,by,bw,bh=b
                if ay==by:
                    direction=1 if bx>ax else -1
                    points=[(ax+aw+5 if direction>0 else ax-5,ay+ah/2),(bx-7 if direction>0 else bx+bw+7,by+bh/2)]
                else:
                    points=[(ax+aw/2,ay+ah+5),(bx+bw/2,by-7)]
                self.arrow(pid+'flow'+str(n),points,fid)
        self.svg.append('</g>')

    def build(self):
        panels=self.content.get('panels',[])
        if not panels:raise ValueError('panels must not be empty')
        ids=[str(p['id']) for p in panels]
        if len(ids)!=len(set(ids)):raise ValueError('Panel IDs must be unique')
        totalw=MARGIN*2+3*PANEL_W+2*GAP
        self.text('title',self.content.get('title','Contraprueba'),MARGIN,36,totalw-MARGIN*2,48)
        self.text('subtitle',self.content.get('subtitle',''),MARGIN,110,totalw-MARGIN*2,25,MUTED)
        x=MARGIN
        for label in COLORS:
            x+=self.badge('legend-'+label,label,x,200)+18
        self.text('legenddesc','Evidencia ≠ validación del producto · Propuesta = diseño sugerido · Por validar = hipótesis o prueba pendiente',MARGIN,246,totalw-96,20,MUTED)
        layouts=[self.measure_panel(p) for p in panels]
        y=TOP
        for row in range(0,len(panels),3):
            rowh=max(l[0] for l in layouts[row:row+3])
            for col in range(3):
                i=row+col
                if i<len(panels):self.panel(panels[i],i,MARGIN+col*(PANEL_W+GAP),y,layouts[i])
            y+=rowh+GAP
        totalh=y
        self.text('footer','Mapa de diseño y evidencia · Ningún indicador constituye diagnóstico ni baremo nacional · Fuentes: badges enlazados y apéndice del visor',MARGIN,totalh-24,totalw-96,20,MUTED)
        scene=dict(type='excalidraw',version=2,source='https://excalidraw.com',elements=self.elements,
                   appState=dict(gridSize=20,gridStep=5,gridModeEnabled=False,viewBackgroundColor='#f0f4f7',
                                 zoom={'value':0.15},scrollX=0,scrollY=0,theme='light',frameRendering={'enabled':True,'clip':False,'name':True,'outline':True}),files={})
        defs='<defs><marker id="arrow" markerWidth="10" markerHeight="10" refX="8" refY="4" orient="auto" markerUnits="strokeWidth"><path d="M0,0 L8,4 L0,8" fill="none" stroke="#6a8094" stroke-width="1.4"/></marker></defs>'
        svg=f'<svg xmlns="http://www.w3.org/2000/svg" width="{totalw}" height="{totalh+40}" viewBox="0 0 {totalw} {totalh+40}" role="img" aria-label="{html.escape(self.content.get("title","Contraprueba"),quote=True)}">'+defs+f'<rect x="0" y="0" width="{totalw}" height="{totalh+40}" fill="#f0f4f7"/>'+''.join(self.svg)+'</svg>'
        ET.fromstring(svg)
        assert len({e['id'] for e in self.elements})==len(self.elements)
        frameids={e['id'] for e in self.elements if e['type']=='frame'}
        assert all(not e['frameId'] or e['frameId'] in frameids for e in self.elements)
        if self.unknown_sources:raise ValueError('Unknown source IDs: '+', '.join(sorted(self.unknown_sources)))
        return scene,svg,[0,0,totalw,totalh+40]


def viewer(content,svg,bounds,overview):
    options='<option value="-1">Mapa completo — seleccionar sección para leer</option>'+''.join(f'<option value="{i}">{html.escape(b["title"])}</option>' for i,b in enumerate(bounds))
    links=''.join(f'<li id="source-{html.escape(str(s["id"]),quote=True)}"><a href="{html.escape(s["url"],quote=True)}" target="_blank" rel="noopener">[{html.escape(str(s["id"]))}] {html.escape(s["title"])}</a></li>' for s in content.get('sources',[]))
    data=json.dumps({'bounds':bounds,'overview':overview},ensure_ascii=False).replace('</','<\\/')
    title=html.escape(content.get('title','Contraprueba'))
    template='''<!doctype html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="icon" href="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 48 48'%3E%3Crect width='48' height='48' rx='12' fill='%23163047'/%3E%3Ctext x='24' y='34' text-anchor='middle' fill='white' font-size='32' font-family='Arial'%3EC%3C/text%3E%3C/svg%3E"><title>@@TITLE@@ — mapa navegable</title>
<style>*{box-sizing:border-box}body{margin:0;background:#eef3f6;color:#163047;font:16px/1.5 system-ui,sans-serif}header{padding:16px 24px;background:white;border-bottom:1px solid #cbd9e2}h1{font-size:22px;margin:0 0 4px}header p{margin:0;color:#536779;font-size:14px}.toolbar{display:flex;flex-wrap:wrap;align-items:center;gap:8px;padding:12px 24px;background:#fff;border-bottom:1px solid #cbd9e2;position:sticky;top:0;z-index:2}button,select,a.download{border:1px solid #afc1cf;background:#fff;border-radius:8px;color:#163047;padding:9px 12px;font:inherit;cursor:pointer}button:hover,a.download:hover{background:#eaf1f8}button:focus-visible,select:focus-visible,a:focus-visible{outline:3px solid #315f9c;outline-offset:3px}select{min-width:270px;max-width:100%;flex:1}a.download{text-decoration:none;background:#163047;color:white}#viewport{height:calc(100vh - 205px);min-height:380px;margin:12px;overflow:hidden;border:1px solid #cbd9e2;border-radius:12px;background:#f0f4f7;touch-action:none}#viewport svg{display:block;width:100%;height:100%;cursor:grab;user-select:none}#viewport svg.dragging{cursor:grabbing}#viewport a{cursor:pointer}#readout{padding:0 24px;color:#536779;font-size:14px;min-height:24px}details{margin:16px 24px 30px;padding:16px;background:white;border:1px solid #cbd9e2;border-radius:12px}summary{font-weight:650;cursor:pointer}li{margin:8px 0;overflow-wrap:anywhere}li a{color:#315f9c}footer{padding:0 24px 24px;color:#536779;font-size:13px}@media(max-width:650px){header,.toolbar{padding:12px}h1{font-size:19px}select{min-width:100%}#viewport{height:65vh;margin:6px}.toolbar button{padding:7px 10px}a.download{font-size:14px}}</style></head><body>
<header><h1>@@TITLE@@</h1><p>Mapa editable + visor de lectura. Entra a una sección para leer; arrastra para desplazar. No es una aplicación educativa funcional.</p></header>
<nav class="toolbar" aria-label="Controles del mapa"><select id="panel" aria-label="Seleccionar sección">@@OPTIONS@@</select><button id="prev" aria-label="Sección anterior">←</button><button id="next" aria-label="Sección siguiente">→</button><button id="fit">Ajustar</button><button id="minus" aria-label="Alejar">−</button><button id="plus" aria-label="Acercar">+</button><a class="download" href="contraprueba-protocolo.excalidraw" download>Descargar Excalidraw</a><a href="#sources">Fuentes</a></nav>
<main><div id="viewport">@@SVG@@</div><div id="readout" aria-live="polite"></div><details id="sources"><summary>Fuentes verificables y alcance</summary><p>Los badges del mapa abren sus fuentes. «Evidencia» identifica sustento externo; no implica que Contraprueba ya haya probado eficacia. Las propuestas y los costes deben validarse en piloto.</p><ol>@@SOURCES@@</ol></details></main><footer>Archivo local, sin analítica, librerías remotas ni llamadas a IA. Abre el archivo .excalidraw en Excalidraw para editar elementos y marcos. Atajos: ←/→ secciones, +/− zoom, 0 ajustar.</footer>
<script>const DATA=@@DATA@@;const svg=document.querySelector('#viewport svg'),select=document.getElementById('panel'),readout=document.getElementById('readout');let current=-1,box=DATA.overview.slice(),drag=null;
function paint(){svg.setAttribute('viewBox',box.join(' '));readout.textContent=current<0?'Vista general · Haz doble clic en una sección o selecciónala arriba.':DATA.bounds[current].title+' · '+(current+1)+' / '+DATA.bounds.length;}
function fit(){if(current<0){box=DATA.overview.slice()}else{const b=DATA.bounds[current],pad=32;box=[b.x-pad,b.y-pad,b.w+pad*2,b.h+pad*2]}paint()}
function go(i){current=Math.max(-1,Math.min(DATA.bounds.length-1,i));select.value=current;svg.querySelectorAll('g[data-panel]').forEach(g=>g.style.display=current<0||g.dataset.panel===DATA.bounds[current].id?'':'none');fit();history.replaceState(null,'',current<0?'#mapa':'#'+DATA.bounds[current].id)}
function zoom(f){const w=box[2]*f,h=box[3]*f;if(w<240||w>DATA.overview[2]*3)return;box=[box[0]+(box[2]-w)/2,box[1]+(box[3]-h)/2,w,h];paint()}
select.addEventListener('change',()=>go(Number(select.value)));document.getElementById('prev').onclick=()=>go(current-1);document.getElementById('next').onclick=()=>go(current+1);document.getElementById('fit').onclick=fit;document.getElementById('plus').onclick=()=>zoom(.8);document.getElementById('minus').onclick=()=>zoom(1.25);
svg.addEventListener('dblclick',e=>{if(e.target.closest('a'))return;const p=e.target.closest('[data-panel]');if(p)go(DATA.bounds.findIndex(b=>b.id===p.dataset.panel))});
svg.addEventListener('pointerdown',e=>{if(e.target.closest('a'))return;const inv=svg.getScreenCTM().inverse();const point=new DOMPoint(e.clientX,e.clientY).matrixTransform(inv);drag={point,box:box.slice(),inv};svg.setPointerCapture(e.pointerId);svg.classList.add('dragging')});svg.addEventListener('pointermove',e=>{if(!drag)return;const p=new DOMPoint(e.clientX,e.clientY).matrixTransform(drag.inv);box=[drag.box[0]+drag.point.x-p.x,drag.box[1]+drag.point.y-p.y,drag.box[2],drag.box[3]];paint()});const end=()=>{drag=null;svg.classList.remove('dragging')};svg.addEventListener('pointerup',end);svg.addEventListener('pointercancel',end);
document.addEventListener('keydown',e=>{if(/SELECT|INPUT|TEXTAREA/.test(e.target.tagName))return;if(e.key==='ArrowRight'){go(current+1);e.preventDefault()}if(e.key==='ArrowLeft'){go(current-1);e.preventDefault()}if(e.key==='+')zoom(.8);if(e.key==='-')zoom(1.25);if(e.key==='0')fit()});
let initial=DATA.bounds.findIndex(b=>'#'+b.id===location.hash);go(initial);document.querySelector('a[href="#sources"]').addEventListener('click',()=>document.getElementById('sources').open=true);
</script></body></html>'''
    for key,val in {'TITLE':title,'OPTIONS':options,'SVG':svg,'SOURCES':links,'DATA':data}.items():template=template.replace('@@'+key+'@@',val)
    return template


def main():
    path=Path(sys.argv[1]) if len(sys.argv)>1 else ROOT/'board-content.json'
    content=json.loads(path.read_text(encoding='utf-8-sig'))
    board=Board(content)
    scene,svg,overview=board.build()
    (ROOT/'contraprueba-protocolo.excalidraw').write_text(json.dumps(scene,ensure_ascii=False,indent=2),encoding='utf-8')
    (ROOT/'contraprueba-protocolo.svg').write_text(svg,encoding='utf-8')
    (ROOT/'contraprueba-protocolo.html').write_text(viewer(content,svg,board.bounds,overview),encoding='utf-8')
    print(json.dumps({'panels':len(board.bounds),'elements':len(board.elements),'frames':sum(e['type']=='frame' for e in board.elements),'sources':len(board.sources),'bounds':overview,'output':str(ROOT),'checks':['unique IDs','valid frame references','all source IDs resolved','SVG XML parsed'],'nativeImport':'not tested'},ensure_ascii=False,indent=2))


if __name__=='__main__':main()
