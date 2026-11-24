import { jsPDF } from 'jspdf';
import { TYPES, SECTIONS, fieldsFor } from './model.js';
import { brandFor, drawBrandLogo, reportTheme } from './brands.js';
import { DISPLAY_FONT } from './report-font.js';
const clean = value => String(value ?? '').replace(/[\u2010-\u2015]/g, '-').replace(/[‘’]/g, "'").replace(/[“”]/g, '"').replace(/…/g, '...').replace(/[^\u0020-\u00ff\n]/g, '');
export const filename = name => `Informe-${name.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-zA-Z0-9]+/g, '-').replace(/^-|-$/g, '') || 'observacion'}.pdf`;

export function buildPDF(type, draft) {
  const doc = new jsPDF({unit:'mm',format:'a4',compress:true});
  doc.addFileToVFS('BebasNeue-Regular.ttf', DISPLAY_FONT);
  doc.addFont('BebasNeue-Regular.ttf', 'Display', 'normal');
  const b = brandFor(type), t = reportTheme(type), left = 13, width = 184, bottom = 274, gap = 8;
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
    const content=lines(value,w-8,summary?10:9),lineHeight=summary?4.6:4.2;
    const wholeHeight=8+content.length*lineHeight+6+2;
    if(wholeHeight<=bottom-bodyTop && wholeHeight>bottom-c.y) next(c);
    let at=0,continued=false;
    while(at<content.length) {
      ensure(c,8+6+Math.min(2,content.length-at)*lineHeight);
      heading(c,label,x,w,continued);
      const capacity=Math.max(1,Math.floor((bottom-c.y-6)/lineHeight));
      const slice=content.slice(at,at+capacity),height=slice.length*lineHeight+6;
      box(x,c.y,w,height,t.card,summary?t.accent:t.border);
      slice.forEach((line,i)=>text(line,x+4,c.y+5+i*lineHeight,summary?10:9,t.text));
      c.y+=height+2;at+=slice.length;
      if(at<content.length){next(c);continued=true;}
    }
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
  const matchH=12+matchLines.length*4.7;
  ensure(cursor,matchH+3);box(left,cursor.y,heroWidth,matchH);
  text('PARTIDO OBSERVADO',left+4,cursor.y+5,6.8,t.accent,'helvetica','normal',{charSpace:.7});
  matchLines.forEach((line,i)=>text(line,left+4,cursor.y+11+i*4.7,9.5,t.text,'helvetica','bold'));
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
  const context=fieldsFor(type).filter(f=>!['name','match','starter',...stats.map(s=>s[0])].includes(f.key));
  const cw=(width-gap)/2, contextCols=3, contextW=(width-2*3)/3;
  for(let i=0;i<context.length;i+=contextCols) {
    const pair=context.slice(i,i+contextCols);
    const cells=pair.map(f=>lines(draft.data[f.key],contextW-7,8.5));
    const height=8+Math.max(...cells.map(c=>c.length))*4;
    ensure(cursor,height+3);
    pair.forEach((f,j)=>{
      const x=left+j*(contextW+3);box(x,cursor.y,contextW,height);
      text(f.label.toUpperCase(),x+3.5,cursor.y+4.5,6,t.accent,'helvetica','normal',{charSpace:.5});
      cells[j].forEach((line,k)=>text(line,x+3.5,cursor.y+9+k*4,8.5,t.text));
    });
    cursor.y+=height+3;
  }
  cursor.y+=3;
  const summary=(draft.report.general||'').trim();
  if(summary)narrative(cursor,'Lectura del partido',summary,left,width,true);
  const sections=SECTIONS.filter(s=>s.key!=='general'&&(draft.report[s.key]||'').trim());
  if(sections.length===1)narrative(cursor,sections[0].label,draft.report[sections[0].key],left,width);
  else if(sections.length) {
    const split=Math.ceil(sections.length/2),groups=[sections.slice(0,split),sections.slice(split)];
    groups.forEach((group,col)=>{
      const column={page:cursor.page,y:cursor.y};
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
