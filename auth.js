(() => {
  const gate = document.createElement('section');
  gate.className = 'auth-gate auth-hidden';
  gate.id = 'authGate';
  gate.innerHTML = `
    <div class="auth-card">
      <div class="auth-brand"><span class="auth-brand-mark">V</span><span><strong>VEX</strong><small>UNIVERSAL APK BUILDER</small></span></div>
      <h2 id="authHeading">Welcome back</h2>
      <p class="auth-subtitle" id="authSubtitle">Sign in to access your build workspace.</p>
      <div class="auth-tabs"><button type="button" class="auth-tab active" data-auth-tab="login">Login</button><button type="button" class="auth-tab" data-auth-tab="register">Create account</button></div>
      <form class="auth-form" id="authForm">
        <label>Email address<input id="authEmail" type="email" autocomplete="email" maxlength="190" required placeholder="you@example.com"></label>
        <label>Password<input id="authPassword" type="password" autocomplete="current-password" minlength="10" maxlength="200" required placeholder="At least 10 characters"></label>
        <button type="button" class="auth-forgot" id="authForgot">Forgot password?</button><button class="primary-button auth-submit" id="authSubmit" type="submit">Sign in</button>
        <div class="auth-message" id="authMessage" role="status"></div>
      </form>
      <p class="auth-privacy">Your password is securely hashed on the server. Never share it with anyone.</p>
    </div>`;
  document.body.appendChild(gate);
  let mode = 'login', csrf = '', pendingPage = 'upload', resetToken = new URLSearchParams(location.search).get('reset') || '';
  window.VEX_REQUIRE_AUTH = page => { pendingPage = page || 'upload'; gate.classList.remove('auth-hidden'); $('authEmail').focus(); };
  const $ = id => document.getElementById(id);
  const message = (text, success=false) => { $('authMessage').textContent=text; $('authMessage').classList.toggle('success',success); };
  function setMode(next) {
    mode=next;
    document.querySelectorAll('[data-auth-tab]').forEach(b=>b.classList.toggle('active',b.dataset.authTab===mode));
    $('authHeading').textContent=mode==='login'?'Welcome back':'Create your account';
    $('authSubtitle').textContent=mode==='login'?'Sign in to access your build workspace.':'Register to save and manage your Android projects.';
    $('authSubmit').textContent=mode==='login'?'Sign in':'Create account';
    $('authPassword').setAttribute('autocomplete',mode==='login'?'current-password':'new-password');
    message('');
  }
  document.querySelectorAll('[data-auth-tab]').forEach(b=>b.addEventListener('click',()=>setMode(b.dataset.authTab)));
  $('authForgot').addEventListener('click',async()=>{
    const email=$('authEmail').value.trim();
    if(!email){message('Enter your account email first.');$('authEmail').focus();return;}
    $('authForgot').disabled=true;message('Requesting reset link…');
    try{const data=await request({action:'forgot_password',email});message(data.message||'If the account exists, a reset email will be sent.',true);}
    catch(err){message(err.message);}
    finally{$('authForgot').disabled=false;}
  });
  if(resetToken){
    $('authHeading').textContent='Choose a new password';
    $('authSubtitle').textContent='Your reset link is ready. Choose a new password.';
    document.querySelector('.auth-tabs').classList.add('auth-hidden');
    $('authEmail').closest('label').classList.add('auth-hidden');
    $('authForgot').classList.add('auth-hidden');
    $('authSubmit').textContent='Update password';
    $('authPassword').setAttribute('autocomplete','new-password');
    $('authPassword').placeholder='Enter a new password';
  }
  async function request(payload) {
    const response=await fetch('/api/auth.php',{method:'POST',credentials:'same-origin',headers:{'Content-Type':'application/json'},body:JSON.stringify({...payload,csrf_token:csrf})});
    const data=await response.json().catch(()=>({ok:false,error:'Server returned an invalid response.'}));
    if(!response.ok||!data.ok) throw new Error(data.error||'Request failed.');
    if(data.csrf_token) csrf=data.csrf_token;
    return data;
  }
  function enter(user) {
    gate.classList.add('auth-hidden');
    document.body.dataset.authenticated='true';
    const top=document.querySelector('.top-actions');
    if(top && !$('authLogout')) {
      const who=document.createElement('span');who.id='authUserEmail';who.className='muted';who.style.cssText='font-size:11px;max-width:150px;overflow:hidden;text-overflow:ellipsis';who.textContent=user.email;top.insertBefore(who,top.firstChild);
      const btn=document.createElement('button');btn.id='authLogout';btn.className='auth-logout';btn.type='button';btn.textContent='Logout';top.appendChild(btn);
      btn.addEventListener('click',async()=>{try{await request({action:'logout'});location.reload();}catch(e){alert(e.message);}});
    }
    const side=document.querySelector('.sidebar-bottom');
    if(side){side.innerHTML='<span class="status-dot"></span><span>Account connected</span><small>'+user.email.replace(/[<>&"]/g,'')+'</small>';}
  }
  $('authForm').addEventListener('submit',async e=>{
    e.preventDefault();$('authSubmit').disabled=true;message(mode==='login'?'Signing in…':'Creating account…');
    try{
      const data = resetToken
        ? await request({action:'reset_password', token:resetToken, password:$('authPassword').value})
        : await request({action:mode, email:$('authEmail').value.trim(), password:$('authPassword').value});
      message(data.message||'Success.',true);
      if (resetToken) {
        history.replaceState({}, '', location.pathname);
        resetToken='';
        $('authPassword').value='';
        $('authEmail').closest('label').classList.remove('auth-hidden');
        document.querySelector('.auth-tabs').classList.remove('auth-hidden');
        $('authForgot').classList.remove('auth-hidden');
        setMode('login');
      } else {
        enter(data.user);
      }
    }catch(err){message(err.message);}
    finally{$('authSubmit').disabled=false;}
  });
  (async()=>{
    try{
      const response=await fetch('/api/auth.php',{credentials:'same-origin',cache:'no-store'});
      const data=await response.json();
      if(!response.ok||!data.ok) throw new Error('Could not connect to the account service.');
      csrf=data.csrf_token||'';
      if(data.authenticated&&data.user) enter(data.user); else if(resetToken) gate.classList.remove('auth-hidden');
    }catch(e){message('Account service unavailable. Please refresh or contact support.');}
  })();
})();