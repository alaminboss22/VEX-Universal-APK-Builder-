const systemTheme=window.matchMedia&&window.matchMedia("(prefers-color-scheme: light)");
if(systemTheme){document.body.classList.toggle("light",systemTheme.matches);systemTheme.addEventListener?.("change",e=>{if(!document.body.dataset.themeManual)document.body.classList.toggle("light",e.matches);});}
const pages = ["dashboard","upload","configure","progress","logs","history","settings","help"];
const labels = {dashboard:"Dashboard",upload:"Upload project",configure:"Build configuration",progress:"Build progress",logs:"Build logs",history:"Build history",settings:"Settings",help:"Help & documentation"};
const $ = s => document.querySelector(s);
const $$ = s => [...document.querySelectorAll(s)];
function icons(){
  const paths={
    "layout-dashboard":'<rect x="3" y="3" width="8" height="8" rx="1.5"/><rect x="13" y="3" width="8" height="5" rx="1.5"/><rect x="13" y="10" width="8" height="11" rx="1.5"/><rect x="3" y="13" width="8" height="8" rx="1.5"/>',
    "cloud-upload":'<path d="M7 18a4 4 0 0 1-.5-8A6 6 0 0 1 18 8a5 5 0 0 1 0 10h-1"/><path d="M12 22V12m-4 4 4-4 4 4"/>',
    "sliders-horizontal":'<path d="M4 21v-7m0-4V3m8 18v-9m0-4V3m8 18v-5m0-4V3M2 14h4m4-6h4m4 8h4"/>',
    "activity":'<path d="M22 12h-4l-3 9L9 3l-3 9H2"/>',
    "terminal":'<path d="m4 17 6-6-6-6m8 14h8"/>',
    "history":'<path d="M3 12a9 9 0 1 0 3-6.7L3 8"/><path d="M3 3v5h5m4-1v5l4 2"/>',
    "settings-2":'<path d="M4 21v-7m0-4V3m8 18v-9m0-4V3m8 18v-5m0-4V3M2 14h4m4-6h4m4 8h4"/>',
    "circle-help":'<circle cx="12" cy="12" r="10"/><path d="M9.1 9a3 3 0 0 1 5.8 1c0 2-3 3-3 3m.1 4h.01"/>',
    "menu":'<path d="M4 6h16M4 12h16M4 18h16"/>',
    "sun-moon":'<circle cx="12" cy="12" r="4"/><path d="M12 2v2m0 16v2M4.93 4.93l1.42 1.42m11.3 11.3 1.42 1.42M2 12h2m16 0h2M4.93 19.07l1.42-1.42m11.3-11.3 1.42-1.42"/>',
    "upload":'<path d="M12 16V4m-4 4 4-4 4 4"/><path d="M4 16v4h16v-4"/>',
    "package-check":'<path d="m12 3 9 5v8l-9 5-9-5V8l9-5Z"/><path d="m3.5 8.5 8.5 5 8.5-5M12 13.5V21m-3-9 2 2 4-4"/>',
    "clock-3":'<circle cx="12" cy="12" r="9"/><path d="M12 7v5h5"/>'
  };
  document.querySelectorAll("[data-lucide]").forEach(el=>{
    const name=el.getAttribute("data-lucide"), body=paths[name]||'<circle cx="12" cy="12" r="9"/>';
    const svg=document.createElementNS("http://www.w3.org/2000/svg","svg");
    svg.setAttribute("viewBox","0 0 24 24");svg.setAttribute("width","20");svg.setAttribute("height","20");
    svg.setAttribute("fill","none");svg.setAttribute("stroke","currentColor");svg.setAttribute("stroke-width","1.8");
    svg.setAttribute("stroke-linecap","round");svg.setAttribute("stroke-linejoin","round");svg.setAttribute("aria-hidden","true");
    svg.innerHTML=body;el.replaceWith(svg);
  });
}
const navBackdrop=document.createElement("div");
navBackdrop.className="mobile-nav-backdrop";
navBackdrop.setAttribute("aria-hidden","true");
document.body.appendChild(navBackdrop);
function closeMobileNav(){ $("#sidebar").classList.remove("open"); navBackdrop.classList.remove("show"); }
navBackdrop.addEventListener("click",closeMobileNav);
function go(page){
  if(!pages.includes(page)) return;
  if(["upload","configure","progress","logs","history","settings"].includes(page) && document.body.dataset.authenticated!=="true"){
    if(window.VEX_REQUIRE_AUTH) window.VEX_REQUIRE_AUTH(page);
    return;
  }
  $$(".page").forEach(p=>p.classList.toggle("active",p.id===`page-${page}`));
  $$(".nav-link").forEach(b=>b.classList.toggle("active",b.dataset.page===page));
  $("#pageCrumb").textContent=labels[page];
  closeMobileNav();
  window.scrollTo({top:0,behavior:"smooth"});
  icons();
}
window.goAfterAuth = page => go(page);
$$(".nav-link").forEach(b=>b.addEventListener("click",()=>go(b.dataset.page)));
$$("[data-go]").forEach(b=>b.addEventListener("click",()=>go(b.dataset.go)));
$("#menuBtn").addEventListener("click",()=>{const opened=$("#sidebar").classList.toggle("open");navBackdrop.classList.toggle("show",opened);$("#menuBtn").setAttribute("aria-expanded",String(opened));});
let toastTimer;
function toast(msg){const el=$("#toast");el.textContent=msg;el.classList.add("show");clearTimeout(toastTimer);toastTimer=setTimeout(()=>el.classList.remove("show"),2600);}
function setTheme(){
  const next=document.body.classList.contains("light")?"dark":"light";
  document.body.classList.toggle("light",next==="light");
  document.body.dataset.themeManual=next;
  document.documentElement.style.colorScheme=next;
  try{localStorage.setItem("vex-theme",next);}catch(e){}
}
(function initTheme(){
  let saved=null;try{saved=localStorage.getItem("vex-theme");}catch(e){}
  if(saved==="light"||saved==="dark"){
    document.body.dataset.themeManual=saved;
    document.body.classList.toggle("light",saved==="light");
    document.documentElement.style.colorScheme=saved;
  }else{
    delete document.body.dataset.themeManual;
    const light=window.matchMedia("(prefers-color-scheme: light)").matches;
    document.body.classList.toggle("light",light);
    document.documentElement.style.colorScheme=light?"light":"dark";
  }
})();
$("#themeBtn").addEventListener("click",setTheme);
$("#themeSetting").addEventListener("click",setTheme);
$$("[data-variant]").forEach(b=>b.addEventListener("click",()=>{$$("[data-variant]").forEach(x=>x.classList.toggle("selected",x===b));}));
let selectedFile=null, serverUploadLimit=100*1024*1024;
const input=$("#zipInput"), drop=$("#dropzone"), result=$("#fileResult"), error=$("#uploadError"), analyze=$("#analyzeBtn");
function showError(msg){error.textContent=msg;error.classList.remove("hidden");}
function clearError(){error.textContent="";error.classList.add("hidden");}
function formatSize(n){return n<1024*1024?`${(n/1024).toFixed(1)} KB`:`${(n/1024/1024).toFixed(2)} MB`;}
function acceptFile(file){
  clearError();
  if(!file)return;
  if(!file.name.toLowerCase().endsWith(".zip")){selectedFile=null;result.classList.add("hidden");analyze.disabled=true;showError("Unsupported file. Please choose a .zip archive.");return;}
  if(file.size===0){showError("This ZIP file is empty.");return;}
  if(file.size>serverUploadLimit){showError(`File exceeds the current server limit (${formatSize(serverUploadLimit)}).`);return;}
  selectedFile=file;
  $("#fileName").textContent=file.name;
  $("#fileSize").textContent=formatSize(file.size);
  $("#fileValidation").textContent="Ready for secure server-side ZIP validation";
  result.classList.remove("hidden");analyze.disabled=false;
}
input.addEventListener("change",e=>acceptFile(e.target.files[0]));
$("#removeFile").addEventListener("click",()=>{selectedFile=null;input.value="";result.classList.add("hidden");analyze.disabled=true;clearError();});
["dragenter","dragover"].forEach(ev=>drop.addEventListener(ev,e=>{e.preventDefault();drop.classList.add("dragging");}));
["dragleave","drop"].forEach(ev=>drop.addEventListener(ev,e=>{e.preventDefault();drop.classList.remove("dragging");}));
drop.addEventListener("drop",e=>acceptFile(e.dataTransfer.files[0]));
async function loadProjects(){
  const list=$("#projectList"); if(!list) return;
  if(document.body.dataset.authenticated!=="true"){list.innerHTML='<p class="muted small">Sign in to see your saved projects.</p>';return;}
  list.innerHTML='<p class="muted small">Loading projects…</p>';
  try{
    const response=await fetch("/api/projects.php",{credentials:"same-origin",cache:"no-store"});
    const data=await response.json();
    if(!response.ok||!data.ok) throw new Error(data.error||"Could not load projects.");
    if(Number.isFinite(data.max_upload_bytes)&&data.max_upload_bytes>0){serverUploadLimit=data.max_upload_bytes;if(selectedFile&&selectedFile.size>serverUploadLimit){analyze.disabled=true;showError("Selected file exceeds the server upload limit.");}}
    if(!data.projects.length){list.innerHTML='<p class="muted small">No uploaded projects yet.</p>';return;}
    list.innerHTML=data.projects.map(p=>'<article class="project-row"><span class="project-file-icon">ZIP</span><span class="project-info"><strong></strong><small></small></span><span class="project-status"></span></article>').join("");
    [...list.querySelectorAll(".project-row")].forEach((row,i)=>{const p=data.projects[i];row.querySelector("strong").textContent=p.project_name;row.querySelector("small").textContent="Project #"+p.id+" · "+p.created_at;row.querySelector(".project-status").textContent=p.status;});
  }catch(err){list.innerHTML="";const p=document.createElement("p");p.className="error-text";p.textContent=err.message;list.appendChild(p);}
}
function uploadProject(){
  if(!selectedFile)return;
  if(document.body.dataset.authenticated!=="true"){if(window.VEX_REQUIRE_AUTH)window.VEX_REQUIRE_AUTH("upload");return;}
  if(selectedFile.size>serverUploadLimit){showError("File exceeds the current server upload limit.");return;}
  clearError(); analyze.disabled=true;
  const progress=$("#uploadProgress"),bar=$("#uploadProgressBar"),label=$("#uploadProgressText");
  progress.classList.remove("hidden");bar.style.width="0%";label.textContent="Preparing secure upload…";
  const form=new FormData();form.append("project_file",selectedFile);form.append("csrf_token",window.VEX_AUTH?.csrfToken||"");
  const xhr=new XMLHttpRequest();xhr.open("POST","/api/projects.php");xhr.withCredentials=true;
  xhr.upload.addEventListener("progress",e=>{if(e.lengthComputable){const pct=Math.round(e.loaded/e.total*100);bar.style.width=pct+"%";label.textContent="Uploading… "+pct+"%";}});
  xhr.onload=async()=>{let data={};try{data=JSON.parse(xhr.responseText);}catch(e){}
    if(xhr.status>=200&&xhr.status<300&&data.ok){bar.style.width="100%";label.textContent="Upload complete";toast("ZIP uploaded and saved to your account.");selectedFile=null;input.value="";result.classList.add("hidden");await loadProjects();}
    else{showError(data.error||"Upload failed. Please try again.");label.textContent="Upload failed";}
    analyze.disabled=!selectedFile;
  };
  xhr.onerror=()=>{showError("Network error. Check your connection and try again.");label.textContent="Upload failed";analyze.disabled=false;};
  xhr.send(form);
}
analyze.addEventListener("click",uploadProject);
$("#refreshProjects")?.addEventListener("click",loadProjects);
window.addEventListener("vex:authenticated",loadProjects);
if(document.body.dataset.authenticated==="true"){loadProjects();loadBuildData();}
$("#saveApi").addEventListener("click",()=>{const v=$("#apiUrl").value.trim();if(v&&!/^https?:\/\/.+/i.test(v)){toast("Enter a valid http:// or https:// URL.");return;}$("#apiSaved").textContent="Preview setting noted. No connection test was made.";toast("Setting saved for this page session.");});
icons();

async function loadBuildData(){
  if(document.body.dataset.authenticated!=="true") return;
  const projectSelect=$("#buildProject");
  // Load projects independently so a missing build-table migration cannot leave this dropdown empty.
  try{
    const projectResponse=await fetch("/api/projects.php",{credentials:"same-origin",cache:"no-store"});
    const projectData=await projectResponse.json();
    if(!projectResponse.ok||!projectData.ok) throw new Error(projectData.error||"Could not load uploaded projects.");
    if(projectSelect){
      const selected=projectSelect.value;
      projectSelect.replaceChildren(new Option("Select an uploaded project",""));
      projectData.projects.forEach(p=>projectSelect.add(new Option(p.project_name+" (#"+p.id+")",String(p.id))));
      if(selected) projectSelect.value=selected;
      if(!projectData.projects.length) projectSelect.replaceChildren(new Option("Upload a project first",""));
    }
  }catch(err){
    if(projectSelect) projectSelect.replaceChildren(new Option("Could not load projects — tap Refresh or reload",""));
    const buildError=$("#buildError");
    if(buildError){buildError.textContent=err.message;buildError.classList.remove("hidden");}
  }
  // Build history is loaded separately; errors here must not break project selection.
  try{
    const response=await fetch("/api/builds.php",{credentials:"same-origin",cache:"no-store"});
    const data=await response.json();
    if(!response.ok||!data.ok) throw new Error(data.error||"Could not load build data.");
    const renderList=(selector,items,empty)=>{
      const el=$(selector);if(!el)return;el.replaceChildren();
      if(!items.length){const p=document.createElement("p");p.className="muted";p.textContent=empty;el.appendChild(p);return;}
      items.forEach(b=>{
        const card=document.createElement("article");card.className="build-data-row";
        const title=document.createElement("strong");title.textContent="#"+b.id+" · "+b.project_name;
        const meta=document.createElement("small");meta.textContent=(b.build_format||"APK").toUpperCase()+" · "+(b.build_type||"debug")+" · "+b.created_at;
        const status=document.createElement("span");status.className="project-status";status.textContent=b.status;
        card.append(title,meta,status);
        if(b.status==="success"&&b.apk_path){const link=document.createElement("a");link.href="/api/worker.php?download="+encodeURIComponent(b.id);link.className="text-button";link.textContent="Download "+(b.build_format||"apk").toUpperCase();link.setAttribute("download","");card.appendChild(link);}
        el.appendChild(card);
      });
    };
    renderList("#buildProgressList",data.builds.filter(b=>["queued","building"].includes(b.status)),"No active build requests.");
    renderList("#buildHistoryList",data.builds,"No build requests yet.");
    const log=$("#buildLogOutput");
    if(log){log.textContent=data.builds.length?data.builds.map(b=>"Build #"+b.id+" ["+b.status+"] · "+b.project_name+"\\n"+(b.log_text||"No log messages yet.")).join("\\n\\n------------------------------\\n\\n"):"No build logs yet.";}
  }catch(err){
    ["#buildProgressList","#buildHistoryList","#buildLogOutput"].forEach(sel=>{const el=$(sel);if(el)el.textContent=err.message;});
  }
}
$("#startBuildBtn")?.addEventListener("click",async()=>{
  const error=$("#buildError");error.classList.add("hidden");
  const payload={action:"create",project_id:Number($("#buildProject").value),config:{
    app_name:$("#buildAppName").value.trim(),package_id:$("#buildPackage").value.trim(),
    version_name:$("#buildVersion").value.trim(),version_code:Number($("#buildVersionCode").value),
    build_format:$("#buildFormat").value,build_type:$("#buildType").value
  },csrf_token:window.VEX_AUTH?.csrfToken||""};
  const btn=$("#startBuildBtn");btn.disabled=true;btn.textContent="Saving request…";
  try{
    const response=await fetch("/api/builds.php",{method:"POST",credentials:"same-origin",headers:{"Content-Type":"application/json"},body:JSON.stringify(payload)});
    const data=await response.json();if(!response.ok||!data.ok)throw new Error(data.error||"Could not create build request.");
    toast("Build request saved. Waiting for build worker.");
    await loadBuildData();go("progress");
  }catch(err){error.textContent=err.message;error.classList.remove("hidden");}
  finally{btn.disabled=false;btn.textContent="Create build request →";}
});
$("#refreshBuildLogs")?.addEventListener("click",loadBuildData);
window.addEventListener("vex:authenticated",loadBuildData);

// Live API + database connection indicator. This does not represent build-worker status.
(function initServerStatus(){
  const sidebar = document.getElementById("sidebarServerStatus");
  const top = document.getElementById("topServerStatus");
  const sideText = document.getElementById("sidebarStatusText");
  const sideDetail = document.getElementById("sidebarStatusDetail");
  const topText = document.getElementById("topServerStatusText");
  if(!sidebar || !top || !sideText || !sideDetail || !topText) return;

  function setStatus(online){
    sidebar.classList.toggle("is-online", online);
    sidebar.classList.toggle("is-offline", !online);
    top.classList.toggle("is-online", online);
    top.classList.toggle("is-offline", !online);
    top.classList.remove("is-checking");
    sideText.textContent = online ? "Online" : "Offline";
    topText.textContent = online ? "Online" : "Offline";
    sideDetail.textContent = online ? "API + Database" : "Server unavailable";
  }

  async function checkServer(){
    try{
      const response = await fetch("/api/health.php", {
        method:"GET",
        cache:"no-store",
        headers:{"Accept":"application/json"}
      });
      if(!response.ok) throw new Error("Health check failed");
      const data = await response.json();
      setStatus(data && data.ok === true && data.database === "connected");
    }catch(error){
      setStatus(false);
    }
  }

  checkServer();
  window.setInterval(checkServer, 30000);
})();
