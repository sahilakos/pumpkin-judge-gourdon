import {categories,displayName,total,type Team} from './contest';
let portraitPromise:Promise<HTMLImageElement>|undefined;
function loadPortrait(){
 if(!portraitPromise)portraitPromise=new Promise<HTMLImageElement>((resolve,reject)=>{
  const image=new Image();
  image.onload=()=>resolve(image);
  image.onerror=()=>{portraitPromise=undefined;reject(new Error('The judge portrait could not be loaded. Please try again.'));};
  image.src='/judge-gourdon.png';
 });
 return portraitPromise;
}
function rounded(c:CanvasRenderingContext2D,x:number,y:number,w:number,h:number,r:number,fill:string,stroke?:string){c.beginPath();c.roundRect(x,y,w,h,r);c.fillStyle=fill;c.fill();if(stroke){c.strokeStyle=stroke;c.lineWidth=2;c.stroke();}}
function line(c:CanvasRenderingContext2D,text:string,x:number,y:number,max:number,size:number,color:string,font='Georgia',align:CanvasTextAlign='left'){c.fillStyle=color;c.textAlign=align;c.font=size+'px '+font;c.fillText(text,x,y,max);}
function wrap(c:CanvasRenderingContext2D,text:string,width:number,size:number){c.font=size+'px Georgia';const words=text.split(/\s+/);const lines:string[]=[];let row='';for(const word of words){if(c.measureText((row?row+' ':'')+word).width>width&&row){lines.push(row);row=word;}else row+=(row?' ':'')+word;}if(row)lines.push(row);return lines.slice(0,2);}
function drawCard(c:CanvasRenderingContext2D,t:Team,index:number,x:number,y:number,portrait:HTMLImageElement){
 c.save();c.translate(x,y);
 const gradient=c.createLinearGradient(0,0,1000,1100);gradient.addColorStop(0,'#302035');gradient.addColorStop(1,'#18111f');
 c.fillStyle=gradient;c.fillRect(0,0,1000,1100);rounded(c,18,18,964,1064,25,'#251a2b','#8a5a44');rounded(c,34,34,932,1032,18,'#241928','#4d354a');
 line(c,'TEAM '+String(index+1).padStart(2,'0'),70,100,650,22,'#efad70','Arial');
 line(c,t.judged?'VERDICT RECORDED':'AWAITING THE VERDICT',930,100,350,18,t.judged?'#c4cc8a':'#a587a4','Arial','right');
 const title=displayName(t,index);const titleRows=wrap(c,title,650,56);
 titleRows.forEach((row,i)=>line(c,row,70,175+i*62,650,56,'#f3d9b9'));
 line(c,t.members.slice(0,t.size).join('  ·  '),70,287,650,32,'#d2b5c8','Arial');
 c.save();c.beginPath();c.arc(852,205,75,0,Math.PI*2);c.clip();
 const side=Math.min(portrait.naturalWidth,portrait.naturalHeight);
 c.drawImage(portrait,(portrait.naturalWidth-side)/2,(portrait.naturalHeight-side)*.15,side,side,777,130,150,150);
 c.restore();c.beginPath();c.arc(852,205,76,0,Math.PI*2);c.strokeStyle='#d99d64';c.lineWidth=3;c.stroke();
 line(c,'JUDGE GOURDON',852,310,190,17,'#d8ad83','Arial','center');
 if(t.pumpkin)line(c,'“'+t.pumpkin+'”',70,325,850,24,'#d5a477');
 categories.forEach((category,i)=>{
  const mx=70+(i%2)*445;const my=365+Math.floor(i/2)*190;
  rounded(c,mx,my,415,165,12,'#1a1222','#66435c');
  line(c,'0'+(i+1)+'  '+category.label.toUpperCase(),mx+25,my+37,365,18,'#c3a1b6','Arial');
  line(c,String(t.scores[category.key]??'—'),mx+25,my+127,270,80,'#f1c692','Arial');
  line(c,'/ 10',mx+385,my+125,90,25,'#977792','Arial','right');
 });
 rounded(c,70,780,860,160,14,'#3b2533','#a36c48');
 line(c,'TOTAL SCORE',100,829,470,22,'#e9b178','Arial');
 line(c,t.judged?'A verdict from Judge Gourdon':'The suspense is intentional.',100,881,500,22,'#bb98ae','Arial');
 line(c,String(total(t)??'—'),825,889,200,95,'#f8bf7e','Arial','right');
 line(c,'/ 40',900,889,90,27,'#d9a681','Arial','right');
 c.strokeStyle='#79533e';c.lineWidth=1;c.beginPath();c.moveTo(70,993);c.lineTo(930,993);c.stroke();
 line(c,'THE MIDNIGHT PUMPKIN COURT',500,1037,850,18,'#ad856d','Arial','center');
 line(c,'HALLOWEEN EDITION  ·  FOUR CATEGORIES  ·  FORTY POINTS',500,1065,850,12,'#846a83','Arial','center');
 c.restore();
}
export async function scorecardPng(entries:{team:Team;index:number}[]):Promise<string> {
 const portrait=await loadPortrait();
 const canvas=document.createElement('canvas');const all=entries.length>1;
 canvas.width=all?2060:1000;canvas.height=all?2260:1100;
 const c=canvas.getContext('2d');if(!c)throw new Error('Your browser cannot create the scorecard image.');
 c.fillStyle='#100b17';c.fillRect(0,0,canvas.width,canvas.height);
 entries.forEach((entry,i)=>drawCard(c,entry.team,entry.index,all?20+(i%2)*1020:0,all?20+Math.floor(i/2)*1120:0,portrait));
 return canvas.toDataURL('image/png');
}

