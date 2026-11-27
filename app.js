const pages = ["dashboard","upload","configure","progress","logs","history","settings","help"];
const labels = {dashboard:"Dashboard",upload:"Upload project",configure:"Build configuration",progress:"Build progress",logs:"Build logs",history:"Build history",settings:"Settings",help:"Help & documentation"};
const $ = s => document.querySelector(s);
const $$ = s => [...document.querySelectorAll(s)];
function icons(){ if(window.lucide) lucide.createIcons(); }
function go(page){
  if(!pages.includes(page)) return;
  $$(".page").forEach(p=>p.classList.toggle("active",p.id===`page-${page}`));
  $$(".nav-link").forEach(b=>b.classList.toggle("active",b.dataset.page===page));
  $("#pageCrumb").textContent=labels[page];
  $("#sidebar").classList.remove("open");
  window.scrollTo({top:0,behavior:"smooth"});
  icons();
}
$$(".nav-link").forEach(b=>b.addEventListener("click",()=>go(b.dataset.page)));
$$("[data-go]").forEach(b=>b.addEventListener("click",()=>go(b.dataset.go)));
$("#menuBtn").addEventListener("click",()=>$("#sidebar").classList.toggle("open"));
let toastTimer;
function toast(msg){const el=$("#toast");el.textContent=msg;el.classList.add("show");clearTimeout(toastTimer);toastTimer=setTimeout(()=>el.classList.remove("show"),2600);}
function setTheme(){document.body.classList.toggle("light");}
$("#themeBtn").addEventListener("click",setTheme);
$("#themeSetting").addEventListener("click",setTheme);
$$("[data-variant]").forEach(b=>b.addEventListener("click",()=>{$$("[data-variant]").forEach(x=>x.classList.toggle("selected",x===b));}));
let selectedFile=null;
const input=$("#zipInput"), drop=$("#dropzone"), result=$("#fileResult"), error=$("#uploadError"), analyze=$("#analyzeBtn");
function showError(msg){error.textContent=msg;error.classList.remove("hidden");}
function clearError(){error.textContent="";error.classList.add("hidden");}
function formatSize(n){return n<1024*1024?`${(n/1024).toFixed(1)} KB`:`${(n/1024/1024).toFixed(2)} MB`;}
function acceptFile(file){
  clearError();
  if(!file)return;
  if(!file.name.toLowerCase().endsWith(".zip")){selectedFile=null;result.classList.add("hidden");analyze.disabled=true;showError("Unsupported file. Please choose a .zip archive.");return;}
  if(file.size===0){showError("This ZIP file is empty.");return;}
  if(file.size>100*1024*1024){showError("File exceeds the 100 MB frontend preview limit.");return;}
  selectedFile=file;
  $("#fileName").textContent=file.name;
  $("#fileSize").textContent=formatSize(file.size);
  $("#fileValidation").textContent="Extension and size checks passed · Archive not inspected";
  result.classList.remove("hidden");analyze.disabled=false;
}
input.addEventListener("change",e=>acceptFile(e.target.files[0]));
$("#removeFile").addEventListener("click",()=>{selectedFile=null;input.value="";result.classList.add("hidden");analyze.disabled=true;clearError();});
["dragenter","dragover"].forEach(ev=>drop.addEventListener(ev,e=>{e.preventDefault();drop.classList.add("dragging");}));
["dragleave","drop"].forEach(ev=>drop.addEventListener(ev,e=>{e.preventDefault();drop.classList.remove("dragging");}));
drop.addEventListener("drop",e=>acceptFile(e.dataTransfer.files[0]));
analyze.addEventListener("click",()=>{if(!selectedFile)return;toast("Backend not connected — file was not uploaded or analyzed.");});
$("#saveApi").addEventListener("click",()=>{const v=$("#apiUrl").value.trim();if(v&&!/^https?:\/\/.+/i.test(v)){toast("Enter a valid http:// or https:// URL.");return;}$("#apiSaved").textContent="Preview setting noted. No connection test was made.";toast("Setting saved for this page session.");});
icons();
