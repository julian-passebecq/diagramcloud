import {deflateRawSync} from 'node:zlib';

/** A tiny ZIP writer (deflate) so the Visio fixture stays readable as XML in this file. */
export function zip(files:Record<string,string>):Uint8Array{
 const local:Buffer[]=[],central:Buffer[]=[];let offset=0;
 const crcTable=Array.from({length:256},(_,n)=>{let c=n;for(let k=0;k<8;k++)c=c&1?0xedb88320^(c>>>1):c>>>1;return c>>>0;});
 const crc=(b:Buffer)=>{let c=0xffffffff;for(const x of b)c=crcTable[(c^x)&0xff]^(c>>>8);return (c^0xffffffff)>>>0;};
 for(const [name,text] of Object.entries(files)){
  const raw=Buffer.from(text,'utf8'),data=deflateRawSync(raw),n=Buffer.from(name,'utf8'),c=crc(raw);
  const h=Buffer.alloc(30);h.writeUInt32LE(0x04034b50,0);h.writeUInt16LE(20,4);h.writeUInt16LE(8,8);h.writeUInt32LE(c,14);h.writeUInt32LE(data.length,18);h.writeUInt32LE(raw.length,22);h.writeUInt16LE(n.length,26);
  local.push(h,n,data);
  const e=Buffer.alloc(46);e.writeUInt32LE(0x02014b50,0);e.writeUInt16LE(20,4);e.writeUInt16LE(20,6);e.writeUInt16LE(8,10);e.writeUInt32LE(c,16);e.writeUInt32LE(data.length,20);e.writeUInt32LE(raw.length,24);e.writeUInt16LE(n.length,28);e.writeUInt32LE(offset,42);
  central.push(e,n);offset+=30+n.length+data.length;
 }
 const size=central.reduce((a,b)=>a+b.length,0),end=Buffer.alloc(22);end.writeUInt32LE(0x06054b50,0);end.writeUInt16LE(Object.keys(files).length,8);end.writeUInt16LE(Object.keys(files).length,10);end.writeUInt32LE(size,12);end.writeUInt32LE(offset,16);
 return new Uint8Array(Buffer.concat([...local,...central,end]));
}
const cells=(c:Record<string,number>)=>Object.entries(c).map(([k,v])=>`<Cell N='${k}' V='${v}'/>`).join('');
const NS=`xmlns='http://schemas.microsoft.com/office/visio/2012/main' xmlns:r='http://schemas.openxmlformats.org/officeDocument/2006/relationships'`;
const rels=(targets:string[])=>`<?xml version='1.0'?><Relationships xmlns='http://schemas.openxmlformats.org/package/2006/relationships'>${targets.map((t,i)=>`<Relationship Id='rId${i+1}' Type='x' Target='${t}'/>`).join('')}</Relationships>`;
const geometry=`<Section N='Geometry' IX='0'><Row T='RelMoveTo' IX='1'><Cell N='X' V='0'/></Row></Section>`;

export function visioFixture():Uint8Array{
 const masters=`<Masters ${NS}><Master ID='2' NameU='Rectangle'><Rel r:id='rId1'/></Master><Master ID='3' NameU='Database'><Rel r:id='rId2'/></Master><Master ID='4' NameU='Dynamic connector'><Rel r:id='rId3'/></Master><Master ID='5' NameU='Container 1'><Rel r:id='rId4'/></Master></Masters>`;
 const master=(shape:string)=>`<MasterContents ${NS}><Shapes>${shape}</Shapes></MasterContents>`;
 const page1=`<PageContents ${NS}><Shapes>
  <Shape ID='1' Type='Shape' Master='2'>${cells({PinX:2,PinY:8,Width:1.5,Height:0.75})}<Text><cp IX='0'/>Web app<cp IX='1'/>&amp; API</Text></Shape>
  <Shape ID='2' Type='Shape' Master='3'>${cells({PinX:5,PinY:8})}</Shape>
  <Shape ID='3' Type='Shape' Master='5'>${cells({PinX:3.5,PinY:8,Width:6,Height:2.5})}<Text>Production VNet</Text></Shape>
  <Shape ID='5' Type='Shape' Master='4'>${cells({BeginX:2.75,BeginY:8,EndX:4.5,EndY:8,EndArrow:13})}<Text>SQL</Text></Shape>
  <Shape ID='6' Type='Shape' Master='4'>${cells({BeginX:2,BeginY:7.6,EndX:2,EndY:5.4,EndArrow:13,LinePattern:2})}</Shape>
  <Shape ID='7' Type='Group'>${cells({PinX:2,PinY:5,Width:1,Height:1})}<Shapes>
   <Shape ID='8' Type='Shape'>${cells({PinX:0.5,PinY:0.7,Width:0.5,Height:0.5})}${geometry}</Shape>
   <Shape ID='9' Type='Shape'>${cells({PinX:0.5,PinY:0.15,Width:1,Height:0.3})}${geometry}<Text>Azure Key Vault</Text></Shape>
  </Shapes></Shape>
  <Shape ID='10' Type='Shape'>${cells({PinX:7,PinY:2,Width:2,Height:0.5})}<Section N='Geometry' IX='0'>${cells({NoFill:1,NoLine:1})}</Section><Text>Drawn for the design review</Text></Shape>
  <Shape ID='11' Type='Foreign'>${cells({PinX:8,PinY:9,Width:1,Height:1})}</Shape>
 </Shapes><Connects><Connect FromSheet='5' FromCell='BeginX' ToSheet='1'/><Connect FromSheet='5' FromCell='EndX' ToSheet='2'/></Connects></PageContents>`;
 const page2=`<PageContents ${NS}><Shapes>
  <Shape ID='1' Type='Shape' Master='2'>${cells({PinX:1,PinY:1,Width:1,Height:0.5})}<Text>Orders service</Text></Shape>
  <Shape ID='2' Type='Shape' Master='2'>${cells({PinX:4,PinY:1,Width:1,Height:0.5})}<Text>Event queue</Text></Shape>
  <Shape ID='3' Type='Shape' Master='4'>${cells({BeginX:1.5,BeginY:1,EndX:3.5,EndY:1,BeginArrow:13,EndArrow:0})}</Shape>
 </Shapes><Connects><Connect FromSheet='3' FromCell='BeginX' ToSheet='1'/><Connect FromSheet='3' FromCell='EndX' ToSheet='2'/></Connects></PageContents>`;
 return zip({
  '[Content_Types].xml':`<?xml version='1.0'?><Types xmlns='http://schemas.openxmlformats.org/package/2006/content-types'/>`,
  'visio/document.xml':`<VisioDocument ${NS}/>`,
  'visio/pages/pages.xml':`<Pages ${NS}><Page ID='0' NameU='Overview' Name='Overview'><PageSheet>${cells({PageWidth:11,PageHeight:11})}</PageSheet><Rel r:id='rId1'/></Page><Page ID='4' NameU='Messaging' Name='Messaging'><Rel r:id='rId2'/></Page><Page ID='5' Name='Background-1' Background='1'><Rel r:id='rId3'/></Page></Pages>`,
  'visio/pages/_rels/pages.xml.rels':rels(['page1.xml','page2.xml','page3.xml']),
  'visio/pages/page1.xml':page1,'visio/pages/page2.xml':page2,'visio/pages/page3.xml':`<PageContents ${NS}><Shapes/></PageContents>`,
  'visio/masters/masters.xml':masters,'visio/masters/_rels/masters.xml.rels':rels(['master1.xml','master2.xml','master3.xml','master4.xml']),
  'visio/masters/master1.xml':master(`<Shape ID='5' Type='Shape'>${cells({Width:1,Height:0.75})}${geometry}</Shape>`),
  'visio/masters/master2.xml':master(`<Shape ID='5' Type='Shape'>${cells({Width:1,Height:1.25})}${geometry}</Shape>`),
  'visio/masters/master3.xml':master(`<Shape ID='5' Type='Shape'>${cells({BeginX:0,BeginY:0,EndX:1,EndY:0,EndArrow:13})}</Shape>`),
  'visio/masters/master4.xml':master(`<Shape ID='5' Type='Shape'>${cells({Width:4,Height:3})}${geometry}<Section N='User'><Row N='msvStructureType'><Cell N='Value' V='"Container"'/></Row></Section></Shape>`),
 });
}
