// sim-utils.js — briques réutilisables par tous les cours.
// Expose window.SimUtils avec : sha256, VFS builders, resolvePath, getNode,
// permissions (canRead/canWrite/canExec/canEnter), tokenize.
(function (global) {
  "use strict";

  // ---------- SHA-256 (WebCrypto, repli JS pur) ----------
  function sha256Fallback(str) {
    const utf8 = unescape(encodeURIComponent(str));
    const K = [], H = [];
    (function(){let n=2,c=0;while(c<64){let p=true;for(let i=2;i*i<=n;i++)if(n%i===0){p=false;break;}if(p)K[c++]=(Math.pow(n,1/3)*4294967296)|0;n++;}})();
    (function(){let n=2,c=0;while(c<8){let p=true;for(let i=2;i*i<=n;i++)if(n%i===0){p=false;break;}if(p)H[c++]=(Math.pow(n,1/2)*4294967296)|0;n++;}})();
    const bytes=[];for(let i=0;i<utf8.length;i++)bytes.push(utf8.charCodeAt(i));
    const bitLen=bytes.length*8;bytes.push(0x80);
    while(bytes.length%64!==56)bytes.push(0);
    const hi=Math.floor(bitLen/4294967296),lo=bitLen>>>0;
    for(let i=3;i>=0;i--)bytes.push((hi>>>(i*8))&255);
    for(let i=3;i>=0;i--)bytes.push((lo>>>(i*8))&255);
    const rotr=(x,n)=>(x>>>n)|(x<<(32-n));
    let Hc=H.slice();
    for(let o=0;o<bytes.length;o+=64){
      const w=new Array(64);
      for(let i=0;i<16;i++)w[i]=(bytes[o+i*4]<<24)|(bytes[o+i*4+1]<<16)|(bytes[o+i*4+2]<<8)|bytes[o+i*4+3];
      for(let i=16;i<64;i++){const s0=rotr(w[i-15],7)^rotr(w[i-15],18)^(w[i-15]>>>3);const s1=rotr(w[i-2],17)^rotr(w[i-2],19)^(w[i-2]>>>10);w[i]=(w[i-16]+s0+w[i-7]+s1)|0;}
      let[a,b,c,d,e,f,g,h]=Hc;
      for(let i=0;i<64;i++){const S1=rotr(e,6)^rotr(e,11)^rotr(e,25);const ch=(e&f)^(~e&g);const t1=(h+S1+ch+K[i]+w[i])|0;const S0=rotr(a,2)^rotr(a,13)^rotr(a,22);const mj=(a&b)^(a&c)^(b&c);const t2=(S0+mj)|0;h=g;g=f;f=e;e=(d+t1)|0;d=c;c=b;b=a;a=(t1+t2)|0;}
      Hc=[(Hc[0]+a)|0,(Hc[1]+b)|0,(Hc[2]+c)|0,(Hc[3]+d)|0,(Hc[4]+e)|0,(Hc[5]+f)|0,(Hc[6]+g)|0,(Hc[7]+h)|0];
    }
    return Hc.map(x=>(x>>>0).toString(16).padStart(8,"0")).join("");
  }
  async function sha256Hex(str){
    if(global.crypto&&global.crypto.subtle&&global.isSecureContext!==false){
      try{
        const buf=await global.crypto.subtle.digest("SHA-256",new TextEncoder().encode(str));
        return Array.from(new Uint8Array(buf)).map(b=>b.toString(16).padStart(2,"0")).join("");
      }catch(e){}
    }
    return sha256Fallback(str);
  }
  function safeEqual(a,b){
    if(a.length!==b.length)return false;
    let r=0;for(let i=0;i<a.length;i++)r|=a.charCodeAt(i)^b.charCodeAt(i);
    return r===0;
  }

  // ---------- Tokenizer shell ----------
  function tokenize(line){
    const out=[];let cur="",q=null,i=0;
    while(i<line.length){
      const ch=line[i];
      if(q){
        if(ch==="\\"&&i+1<line.length){cur+=line[i+1];i+=2;continue;}
        if(ch===q){q=null;i++;continue;}
        cur+=ch;i++;continue;
      }
      if(ch==="'"||ch==='"'){q=ch;i++;continue;}
      if(ch===" "||ch==="\t"){if(cur){out.push(cur);cur="";}i++;continue;}
      cur+=ch;i++;
    }
    if(cur)out.push(cur);
    return out;
  }
  function normalize(s){return String(s||"").trim().replace(/\s+/g," ");}
  function baseName(p){const s=String(p).split("/").filter(Boolean);return s.length?s[s.length-1]:"/";}

  // ---------- VFS : constructeurs ----------
  // perms = "rwxrwx" (6 chars) : idx 0=r 1=w 2=x (owner) · 3=r 4=w 5=x (other)
  function dir(children,meta){return Object.assign({type:"d",children:children||{},perms:"rwxr-x",owner:"root",mtime:"Jan  1 00:00"},meta||{});}
  function file(content,meta){
    const c=content==null?"":String(content);
    return Object.assign({type:"f",content:c,size:c.length,perms:"rw-r--",owner:"root",mtime:"Jan  1 00:00"},meta||{});
  }
  function suidNode(content,meta){
    return file(content,Object.assign({suid:true,perms:"rwsr-x",owner:"root",filetype:"ELF 32-bit LSB executable"},meta||{}));
  }

  // ---------- Chemins ----------
  function splitPath(p){return String(p).split("/").filter(Boolean);}
  function resolvePath(root,cwdPath,raw){
    if(!raw||raw==="")return cwdPath;
    let parts;
    if(raw.startsWith("~")){parts=splitPath(raw.replace("~","/"));}
    else if(raw.startsWith("/")){parts=splitPath(raw);}
    else{parts=splitPath(cwdPath+"/"+raw);}
    const out=[];
    parts.forEach(seg=>{
      if(seg===".")return;
      if(seg===".."){out.pop();return;}
      out.push(seg);
    });
    return "/"+out.join("/");
  }
  function getNode(root,abs){
    if(!abs||abs==="/")return root;
    const parts=splitPath(abs);
    let node=root;
    for(const seg of parts){
      if(!node||node.type!=="d"||!node.children||!node.children[seg])return null;
      node=node.children[seg];
    }
    return node;
  }
  function dirName(p){const s=splitPath(p);s.pop();return "/"+s.join("/");}

  // ---------- Permissions ----------
  function canRead(node,user){
    if(user==="root")return true;
    if(!node||!node.perms)return true;
    if(node.owner===user)return node.perms[0]==="r";
    return node.perms[3]==="r";
  }
  function canWrite(node,user){
    if(user==="root")return true;
    if(!node||!node.perms)return true;
    if(node.owner===user)return node.perms[1]==="w";
    return node.perms[4]==="w";
  }
  function canExec(node,user){
    if(user==="root")return true;
    if(!node||!node.perms)return true;
    if(node.owner===user)return node.perms[2]==="x"||!!node.suid;
    return node.perms[5]==="x"||!!node.suid;
  }
  function canEnter(node,user){return canExec(node,user)||canRead(node,user);}

  global.SimUtils={
    sha256Hex,safeEqual,tokenize,normalize,baseName,
    dir,file,suidNode,
    resolvePath,getNode,dirName,splitPath,
    canRead,canWrite,canExec,canEnter
  };
})(window);
