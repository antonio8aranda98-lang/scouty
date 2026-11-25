import { jsPDF } from 'jspdf';
import { TYPES, SECTIONS, fieldsFor } from './model.js';
import { brandFor, drawBrandLogo, reportTheme } from './brands.js';
import { DISPLAY_FONT } from './report-font.js';
import { HEATMAP_LEVELS, HEATMAP_ZONES, hasHeatmap, normalizeHeatmap, heatmapColors } from './heatmap.js';
const clean = value => String(value ?? '').replace(/[\u2010-\u2015]/g, '-').replace(/[‘’]/g, "'").replace(/[“”]/g, '"').replace(/…/g, '...').replace(/[^\u0020-\u00ff\n]/g, '');
export const filename = name => `Informe-${name.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-zA-Z0-9]+/g, '-').replace(/^-|-$/g, '') || 'observacion'}.pdf`;

export function buildPDF(type, draft) {
  const doc = new jsPDF({unit:'mm',format:'a4',compress:true});
  doc.addFileToVFS('BebasNeue-Regular.ttf', DISPLAY_FONT);
  doc.addFont('BebasNeue-Regular.ttf', 'Display', 'normal');
  const b = brandFor(type), t = reportTheme(type), left = 13, width = 184, bottom = 274, gap = 8;
  const includeMap=hasHeatmap(draft.heatmap), bodySize=includeMap?8.5:9, bodyLine=includeMap?3.8:4.2, padding=includeMap?4:6;
  const bodyTop = 36;
  doc.setProperties({title:`Informe de ${clean(draft.data.name)}`,subject:TYPES[type].label,creator:'Scouty'});
  function text(value,x,y,size=10,color=t.text,font='helvetica',weight='normal',options={}) {
    doc.setFont(font,weight); doc.setFontSize(size); doc.setTextColor(...color);
    doc.text(clean(value),x,y,{renderingMode:'fill',...options});
  }
  function lines(value,w,size=10,font='helvetica',weight='normal') {
    doc.setFont(font,weight); doc.setFontSize(size);
    return doc.splitTextToSize(clean(value),w);
  }
  function box(x,y,w,h,fill=t.card,stroke=t.border,radius=2.5) {
    doc.setFillColor(...fill); doc.setDrawColor(...stroke); doc.setLineWidth(.25);
    doc.roundedRect(x,y,w,h,radius,radius,'FD');
  }
  function pageBackground(continuation=false) {
    doc.setFillColor(...t.bg); doc.rect(0,0,210,297,'F');
    doc.setFillColor(...t.card); doc.triangle(132,0,210,0,210,94,'F');
  }
  function pageHeader(continuation=false) {
    doc.setFillColor(255,255,255); doc.roundedRect(left,9,13,15,2,2,'F');
    drawBrandLogo(doc,type,left+2,11,9,11);
    const title=type==='united'?'UNITED':'HUNDRA';
    text(title,31,16,13,t.text,'helvetica','bold');
    text(type==='united'?'SPORTS AGENCY':'SPORTS',31,22,7.3,t.muted);
    const badge=continuation?'INFORME · CONTINUACION':'INFORME DE PARTIDO';
    box(137,11,60,9,t.bg,t.accent,4);
    text(badge,167,17,7,t.accent,'helvetica','normal',{align:'center',charSpace:.35});
    if(continuation) text(draft.data.name,left,31,8,t.muted);
  }
  pageBackground();
  const cursor={page:1,y:37};
  function select(c) { doc.setPage(c.page); }
  function next(c) {
    c.page++;
    if(c.page>doc.getNumberOfPages()) { doc.addPage(); pageBackground(true); }
    else select(c);
    c.y=bodyTop;
  }
  function ensure(c,h) { select(c); if(c.y+h>bottom) next(c); }
  function heading(c,label,x,w,continued=false) {
    ensure(c,17);
    const caption=label+(continued?' · CONT.':'');
    text(caption.toUpperCase(),x,c.y+5,16,t.accent,'Display');
    doc.setFont('Display','normal'); doc.setFontSize(16);
    const labelW=Math.min(doc.getTextWidth(clean(caption.toUpperCase()))+4,w-7);
    doc.setDrawColor(...t.border); doc.setLineWidth(.25); doc.line(x+labelW,c.y+3,x+w,c.y+3);
    c.y+=8;
  }
  function narrative(c,label,value,x,w,summary=false) {
    const content=lines(value,w-8,summary?10:bodySize),lineHeight=summary?4.6:bodyLine;
    const wholeHeight=8+content.length*lineHeight+padding+2;
    if(wholeHeight<=bottom-bodyTop && wholeHeight>bottom-c.y) next(c);
    let at=0,continued=false;
    while(at<content.length) {
      ensure(c,8+padding+Math.min(2,content.length-at)*lineHeight);
      heading(c,label,x,w,continued);
      const capacity=Math.max(1,Math.floor((bottom-c.y-padding)/lineHeight));
      const slice=content.slice(at,at+capacity),height=slice.length*lineHeight+padding;
      box(x,c.y,w,height,t.card,summary?t.accent:t.border);
      slice.forEach((line,i)=>text(line,x+4,c.y+4.5+i*lineHeight,summary?10:bodySize,t.text));
      c.y+=height+2;at+=slice.length;
      if(at<content.length){next(c);continued=true;}
    }
  }
  function presenceMap(c,x,w) {
    const pitchW=w-8, pitchH=pitchW*2/3, height=8+5+pitchH+13;
    ensure(c,height); heading(c,'Mapa de presencia',x,w);
    text('SENTIDO DE ATAQUE',x,c.y+3,5.8,t.accent);
    doc.setDrawColor(...t.accent);doc.setLineWidth(.35);
    doc.line(x+34,c.y+2,x+w-2,c.y+2);doc.line(x+w-5,c.y,x+w-2,c.y+2);doc.line(x+w-5,c.y+4,x+w-2,c.y+2);
    const y=c.y+5, scale=pitchW/420, px=v=>x+4+v*scale, py=v=>y+v*scale;
    const map=normalizeHeatmap(draft.heatmap), colors=heatmapColors(type);
    doc.setFillColor(...t.card);doc.roundedRect(x+4,y,pitchW,pitchH,2,2,'F');
    HEATMAP_ZONES.forEach(zone=>{
      doc.setFillColor(...colors[map[zone.index]]);
      doc.roundedRect(px(12+zone.column*100),py(12+zone.row*260/3),96*scale,(260/3-4)*scale,1,1,'F');
    });
    doc.setDrawColor(...t.muted);doc.setLineWidth(.2);
    doc.rect(px(10),py(10),400*scale,260*scale);doc.line(px(210),py(10),px(210),py(270));
    doc.circle(px(210),py(140),34*scale,'S');
    for(const [start,direction] of [[10,1],[410,-1]]) {
      doc.rect(px(start),py(63),66*scale*direction,154*scale);
      doc.rect(px(start),py(105),26*scale*direction,70*scale);
      doc.rect(px(start-6*direction),py(115),6*scale*direction,50*scale);
    }
    HEATMAP_ZONES.forEach(zone=>text(map[zone.index]||'-',px(60+zone.column*100),py(55+zone.row*260/3),8,map[zone.index]===3?t.bg:t.text,'helvetica','bold',{align:'center'}));
    const legendY=y+pitchH+4.5;
    HEATMAP_LEVELS.forEach((label,i)=>{
      const lx=x+i*w/4;doc.setFillColor(...colors[i]);doc.setDrawColor(...t.border);doc.roundedRect(lx,legendY-2.3,3.2,3.2,.6,.6,'FD');
      text(i||'-',lx+1.6,legendY,4.5,i===3?t.bg:t.text,'helvetica','bold',{align:'center'});
      text(label,lx+4.4,legendY,5.6,t.muted);
    });
    text('Mapa orientativo según mi observación.',x,legendY+5.5,6,t.muted);
    c.y+=5+pitchH+13;
  }
  text(type==='hundra'?'SEGUIMIENTO · HUNDRA SPORTS':type==='scouting'?'CAPTACION · HUNDRA SPORTS':'CAPTACION · UNITED SPORTS AGENCY',left,cursor.y,7,t.accent,'helvetica','normal',{charSpace:1});
  const heroTop=cursor.y+5, heroWidth=114, statsX=135, statsWidth=62;
  cursor.y+=7;
  const words=clean(draft.data.name).toUpperCase().split(/\s+/).filter(Boolean);
  const nameParts=words.length>1?[words[0],words.slice(1).join(' ')]:[words[0]||'INFORME'];
  let nameSize=36;
  if(nameParts.flatMap(p=>lines(p,heroWidth,36,'Display')).length>4)nameSize=24;
  for(const [partIndex,part] of nameParts.entries()) {
    for(const line of lines(part,heroWidth,nameSize,'Display')) {
      ensure(cursor,13); doc.setDrawColor(...t.accent); doc.setLineWidth(.22);
      text(line,left,cursor.y+10,nameSize,partIndex?t.accent:t.text,'Display','normal',{renderingMode:partIndex?'stroke':'fill'});
      cursor.y+=13;
    }
  }
  cursor.y+=4;
  const matchLines=lines(draft.data.match,heroWidth-8,9.5,'helvetica','bold');
  const resultLines=lines(`RESULTADO: ${draft.data.result}`,heroWidth-8,9,'helvetica','bold');
  const matchH=14+matchLines.length*4.7+resultLines.length*4.5;
  ensure(cursor,matchH+3);box(left,cursor.y,heroWidth,matchH);
  text('PARTIDO OBSERVADO',left+4,cursor.y+5,6.8,t.accent,'helvetica','normal',{charSpace:.7});
  matchLines.forEach((line,i)=>text(line,left+4,cursor.y+11+i*4.7,9.5,t.text,'helvetica','bold'));
  resultLines.forEach((line,i)=>text(line,left+4,cursor.y+12+matchLines.length*4.7+i*4.5,9,t.accent,'helvetica','bold'));
  cursor.y+=matchH+5;
  const stats=[['minutes','MINUTOS'],['rating','NOTA MEDIA'],['goals','GOLES'],['assists','ASISTENCIAS'],['saves','PARADAS'],['starter','PARTICIPACION']];
  const sw=(statsWidth-3)/2;
  stats.forEach(([key,label],i)=>{
    const x=statsX+(i%2)*(sw+3), y=heroTop+Math.floor(i/2)*18, score=key==='rating';
    box(x,y,sw,15,score?t.accent:t.card,score?t.accent:t.border);
    text(clean(draft.data[key])+(score?'/10':''),x+sw/2,y+7.5,key==='starter'?13:17,score?t.bg:t.text,'Display','normal',{align:'center'});
    text(label,x+sw/2,y+12,5.8,score?t.bg:t.accent,'helvetica','normal',{align:'center',charSpace:.1});
  });
  cursor.y=Math.max(cursor.y,heroTop+55)+2;
  const context=fieldsFor(type).filter(f=>!['name','match','result','starter',...stats.map(s=>s[0])].includes(f.key));
  const cw=(width-gap)/2, contextCols=3, contextW=(width-2*3)/3;
  for(let i=0;i<context.length;i+=contextCols) {
    const pair=context.slice(i,i+contextCols);
    const cells=pair.map(f=>lines(draft.data[f.key],contextW-7,8.5));
    const height=(includeMap?7:8)+Math.max(...cells.map(c=>c.length))*4;
    ensure(cursor,height+3);
    pair.forEach((f,j)=>{
      const x=left+j*(contextW+3);box(x,cursor.y,contextW,height);
      text(f.label.toUpperCase(),x+3.5,cursor.y+4.5,6,t.accent,'helvetica','normal',{charSpace:.5});
      cells[j].forEach((line,k)=>text(line,x+3.5,cursor.y+9+k*4,8.5,t.text));
    });
    cursor.y+=height+(includeMap?2:3);
  }
  cursor.y+=includeMap?1:3;
  const summary=(draft.report.general||'').trim();
  if(summary)narrative(cursor,'Lectura del partido',summary,left,width,true);
  const sections=SECTIONS.filter(s=>s.key!=='general'&&(draft.report[s.key]||'').trim());
  if(sections.length===1&&!includeMap)narrative(cursor,sections[0].label,draft.report[sections[0].key],left,width);
  else if(sections.length||includeMap) {
    let split=Math.ceil(sections.length/2);
    if(includeMap) {
      const heights=sections.map(s=>8+padding+2+lines(draft.report[s.key],cw-8,bodySize).length*bodyLine);
      let best=Infinity;
      for(let i=0;i<=sections.length;i++) {
        const height=Math.max(heights.slice(0,i).reduce((a,b)=>a+b,0),26+(cw-8)*2/3+heights.slice(i).reduce((a,b)=>a+b,0));
        if(height<best){best=height;split=i;}
      }
    }
    const groups=[sections.slice(0,split),sections.slice(split)];
    groups.forEach((group,col)=>{
      const column={page:cursor.page,y:cursor.y};
      if(includeMap&&col===1)presenceMap(column,left+cw+gap,cw);
      for(const s of group)narrative(column,s.label,draft.report[s.key],left+col*(cw+gap),cw);
    });
  }
  const count=doc.getNumberOfPages();
  for(let page=1;page<=count;page++) {
    doc.setPage(page); pageHeader(page!==1); doc.setDrawColor(...t.border);doc.setLineWidth(.25);doc.line(left,282,197,282);
    if(type==='united'){doc.setDrawColor(...t.secondary);doc.setLineWidth(.6);doc.line(177,282,197,282);}
    text(type==='united'?'UNITED SPORTS AGENCY':'HUNDRA SPORTS',left,287,8,t.text,'helvetica','bold');
    text('OBSERVACION DE UN PARTIDO · USO AUTORIZADO',left,291,5.8,t.muted,'helvetica','normal',{charSpace:.3});
    text(`${page} / ${count}`,197,288,8,t.accent,'helvetica','normal',{align:'right'});
  }
  return doc;
}
