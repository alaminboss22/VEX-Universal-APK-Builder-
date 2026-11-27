const systemTheme=window.matchMedia&&window.matchMedia("(prefers-color-scheme: light)");
if(systemTheme){document.body.classList.toggle("light",systemTheme.matches);systemTheme.addEventListener?.("change",e=>{if(!document.body.dataset.themeManual)document.body.classList.toggle("light",e.matches);});}
const pages = ["dashboard","upload","configure","progress","logs","history","settings","help"];
const labels = {dashboard:"Dashboard",upload:"Upload project",configure:"Build configuration",progress:"Build progress",logs:"Build logs",history:"Build history",settings:"Settings",help:"Help & documentation"};
const $ = s => document.querySelector(s);
const $$ = s => [...document.querySelectorAll(s)];
function icons(){ if(window.lucide) lucide.createIcons(); }
const navBackdrop=document.createElement("div");
navBackdrop.className="mobile-nav-backdrop";
navBackdrop.setAttribute("aria-hidden","true");
document.body.appendChild(navBackdrop);
function closeMobileNav(){ $("#sidebar").classList.remove("open"); navBackdrop.classList.remove("show"); }
navBackdrop.addEventListener("click",closeMobileNav);
function go(page){
  if(!pages.includes(page)) return;
  $$(".page").forEach(p=>p.classList.toggle("active",p.id===`page-${page}`));
  $$(".nav-link").forEach(b=>b.classList.toggle("active",b.dataset.page===page));
  $("#pageCrumb").textContent=labels[page];
  closeMobileNav();
  window.scrollTo({top:0,behavior:"smooth"});
  icons();
}
$$(".nav-link").forEach(b=>b.addEventListener("click",()=>go(b.dataset.page)));
$$("[data-go]").forEach(b=>b.addEventListener("click",()=>go(b.dataset.go)));
$("#menuBtn").addEventListener("click",()=>{const opened=$("#sidebar").classList.toggle("open");navBackdrop.classList.toggle("show",opened);});
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
if(document.body.dataset.authenticated==="true") loadProjects();
$("#saveApi").addEventListener("click",()=>{const v=$("#apiUrl").value.trim();if(v&&!/^https?:\/\/.+/i.test(v)){toast("Enter a valid http:// or https:// URL.");return;}$("#apiSaved").textContent="Preview setting noted. No connection test was made.";toast("Setting saved for this page session.");});
icons();


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
