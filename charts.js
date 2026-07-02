/* ============================================================
   Tiny self-contained SVG charts (donut, bars, line, hbars)
   ============================================================ */
const Charts = {
  donut(data, opts={}){
    // data: [{label,value,color}]
    const total = data.reduce((s,d)=>s+d.value,0) || 1;
    const R=70, r=44, cx=90, cy=90; let a0=-Math.PI/2;
    const arcs = data.map(d=>{
      const frac=d.value/total, a1=a0+frac*2*Math.PI;
      const big=frac>0.5?1:0;
      const x0=cx+R*Math.cos(a0), y0=cy+R*Math.sin(a0);
      const x1=cx+R*Math.cos(a1), y1=cy+R*Math.sin(a1);
      const xi1=cx+r*Math.cos(a1), yi1=cy+r*Math.sin(a1);
      const xi0=cx+r*Math.cos(a0), yi0=cy+r*Math.sin(a0);
      a0=a1;
      if(frac===0) return '';
      return `<path d="M${x0} ${y0} A${R} ${R} 0 ${big} 1 ${x1} ${y1} L${xi1} ${yi1} A${r} ${r} 0 ${big} 0 ${xi0} ${yi0} Z" fill="${d.color}"/>`;
    }).join('');
    const legend = data.map(d=>`<div class="lg"><span class="dot" style="background:${d.color}"></span>${d.label} <b style="margin-left:4px">${d.value}</b></div>`).join('');
    return `<div style="display:flex;align-items:center;gap:24px;flex-wrap:wrap">
      <svg viewBox="0 0 180 180" width="180" height="180">${arcs}
        <text x="90" y="86" text-anchor="middle" font-size="26" font-weight="800" fill="#1f2330">${opts.center??total}</text>
        <text x="90" y="106" text-anchor="middle" font-size="11" fill="#8a91a3">${opts.centerLabel||'Total'}</text>
      </svg><div class="legend" style="flex-direction:column;gap:9px">${legend}</div></div>`;
  },

  hbars(data, opts={}){
    const max = Math.max(...data.map(d=>d.value),1);
    return `<div style="display:flex;flex-direction:column;gap:14px">`+data.map(d=>`
      <div>
        <div style="display:flex;justify-content:space-between;font-size:12.5px;margin-bottom:5px"><span>${d.label}</span><b>${d.value}${opts.suffix||''}</b></div>
        <div class="bar-track" style="height:10px"><div class="bar-fill" style="width:${d.value/max*100}%;background:${d.color||'var(--primary)'}"></div></div>
      </div>`).join('')+`</div>`;
  },

  // grouped stacked bar per row (store status)
  stacked(rows, segs){
    return `<div style="display:flex;flex-direction:column;gap:16px">`+rows.map(row=>{
      const total=segs.reduce((s,seg)=>s+(row[seg.key]||0),0)||1;
      const bar=segs.map(seg=>{
        const v=row[seg.key]||0; if(!v) return '';
        return `<div title="${seg.label}: ${v}" style="width:${v/total*100}%;background:${seg.color}"></div>`;
      }).join('');
      return `<div>
        <div style="font-size:13px;margin-bottom:6px;font-weight:600">${row.store}</div>
        <div style="display:flex;height:18px;border-radius:6px;overflow:hidden;border:1px solid var(--line)">${bar}</div>
      </div>`;
    }).join('')+`</div>
    <div class="legend">${segs.map(s=>`<div class="lg"><span class="dot" style="background:${s.color}"></span>${s.label}</div>`).join('')}</div>`;
  },

  line(series, opts={}){
    // series: [{label,data:[],color}], xlabels
    const W=560,H=240,pad=34;
    const all=series.flatMap(s=>s.data); const max=Math.max(...all,1);
    const n=opts.x.length;
    const X=i=> pad + i*(W-pad*2)/(n-1);
    const Y=v=> H-pad - (v/max)*(H-pad*1.4);
    const grid=[0,.25,.5,.75,1].map(f=>{const y=H-pad-f*(H-pad*1.4);return `<line x1="${pad}" y1="${y}" x2="${W-pad}" y2="${y}" stroke="#eef0f5"/><text x="${pad-8}" y="${y+4}" text-anchor="end" font-size="10" fill="#8a91a3">${Math.round(max*f)}</text>`}).join('');
    const xlab=opts.x.map((l,i)=> i%2===0?`<text x="${X(i)}" y="${H-12}" text-anchor="middle" font-size="10" fill="#8a91a3">${l}</text>`:'').join('');
    const paths=series.map(s=>{
      const pts=s.data.map((v,i)=>`${X(i)},${Y(v)}`);
      const fill=`M${X(0)},${H-pad} L`+pts.join(' L')+` L${X(n-1)},${H-pad} Z`;
      const line='M'+pts.join(' L');
      return `<path d="${fill}" fill="${s.color}" opacity="0.08"/><path d="${line}" fill="none" stroke="${s.color}" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>`+
             s.data.map((v,i)=>`<circle cx="${X(i)}" cy="${Y(v)}" r="3" fill="#fff" stroke="${s.color}" stroke-width="2"/>`).join('');
    }).join('');
    const legend=series.map(s=>`<div class="lg"><span class="dot" style="background:${s.color}"></span>${s.label}</div>`).join('');
    return `<svg viewBox="0 0 ${W} ${H}" width="100%" style="max-width:${W}px">${grid}${xlab}${paths}</svg><div class="legend">${legend}</div>`;
  },
};
