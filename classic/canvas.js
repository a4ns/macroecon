(function(){
'use strict';
const AMS=window.AMS, L=AMS.L, Lua=window.Lua, U=Lua.util, tostr=U.tostr, LT=Lua.LuaTable;
const num=v=>typeof v==='number'?v:(U.tonum(v)||0);
const cs=AMS.colorStr;
const cv=id=>AMS.canvases[num(id)];
L.defineTable('Canvas',{
  Create:(w,h,c,b)=>AMS.canvasCreate(num(w),num(h),c),
  ShowFrame:(hw,id,x,y,t)=>AMS.frameShow(num(id),num(x),num(y)),
  LoadFrame:(f,id)=>{AMS.frameLoad(num(f),num(id));},
  FreeFrame:f=>{AMS.frameFree(num(f));},
  Free:id=>{delete AMS.canvases[num(id)];},
  DrawLine:(id,x1,y1,x2,y2,c)=>{const k=cv(id);if(!k)return;const g=k.g;g.strokeStyle=cs(c);g.lineWidth=1;g.beginPath();g.moveTo(Math.round(num(x1))+.5,Math.round(num(y1))+.5);g.lineTo(Math.round(num(x2))+.5,Math.round(num(y2))+.5);g.stroke();},
  DrawBox:(id,x1,y1,x2,y2,c,nofill)=>{const k=cv(id);if(!k)return;const g=k.g;if(!nofill){g.fillStyle=cs(c);g.fillRect(num(x1),num(y1),num(x2)-num(x1),num(y2)-num(y1));}else{g.strokeStyle=cs(c);g.lineWidth=1;g.strokeRect(num(x1)+.5,num(y1)+.5,num(x2)-num(x1),num(y2)-num(y1));}},
  DrawCircle:(id,x,y,r,c,fill)=>{const k=cv(id);if(!k)return;const g=k.g;g.beginPath();g.arc(num(x),num(y),num(r),0,7);if(fill){g.fillStyle=cs(c);g.fill();}else{g.strokeStyle=cs(c);g.lineWidth=1;g.stroke();}},
  DrawText:(id,x,y,t,c,ang,p)=>{const k=cv(id);if(!k)return;const g=k.g;let font='Times New Roman',size=9,ul=false;
    if(p instanceof LT){if(p.get('Font'))font=tostr(p.get('Font'));if(p.get('Size'))size=num(p.get('Size'));ul=!!p.get('Underline');}
    g.font=`${Math.round(size*4/3)}px "${font}", "Times New Roman", serif`;g.fillStyle=cs(c);g.textBaseline='top';const s=tostr(t);g.fillText(s,num(x),num(y));
    if(ul){const w=g.measureText(s).width;g.fillRect(num(x),num(y)+Math.round(size*4/3)+1,w,1);}},
});
})();
