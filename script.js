:root{
  --bg:#0f0f10;
  --panel:#1a1a1c;
  --muted:#2a2a2e;
  --text:#e9e9ef;
  --accent:#ffd34d;
  --accent-contrast:#222;
  --border:#33343a;
}

*{box-sizing:border-box}
html,body{height:100%}
body{
  margin:0;
  font-family:system-ui,Segoe UI,Roboto,Helvetica,Arial,sans-serif;
  background:var(--bg);
  color:var(--text);
}

/* Header */
.site-header{
  position:sticky; top:0; z-index:10;
  background:#141417; border-bottom:1px solid var(--border);
}
.container{max-width:980px; margin:0 auto; padding:16px;}
.header-inner{display:flex; align-items:center; justify-content:space-between; gap:16px;}
.brand-link{color:var(--accent); text-decoration:none; font-weight:700; font-size:1.15rem}
.nav a{color:#bbb; text-decoration:none; margin-left:16px}
.nav a:hover{color:#fff}

/* Main card */
.card{
  background:var(--panel);
  border:1px solid var(--border);
  border-radius:12px; padding:20px; margin:24px 0;
  box-shadow: 0 6px 20px rgba(0,0,0,.25);
}
h1{margin:0 0 8px}
h2{margin:18px 0 8px}
select{background:#111; color:var(--text); border:1px solid var(--border); padding:8px; border-radius:8px}

.upgrades{margin:8px 0 4px}
.check{display:flex; gap:10px; align-items:flex-start; margin:8px 0}
.check input{margin-top:4px}

.results{background:var(--muted); border:1px solid var(--border); border-radius:8px; padding:12px; margin-top:12px}
.hp-disclaimer{font-size:.85rem; color:#bbb; margin-left:6px}

.actions{margin-top:16px}
.btn{
  border:1px solid var(--border); background:#232327; color:var(--text);
  padding:10px 14px; border-radius:10px; cursor:pointer;
}
.btn:hover{filter:brightness(1.08)}
.btn.primary{background:var(--accent); color:var(--accent-contrast); border-color:#c5a83b; font-weight:700}

/* Footer */
.site-footer{border-top:1px solid var(--border); background:#141417; margin-top:24px}
.footer-inner{display:flex; flex-direction:column; gap:6px}
.small{font-size:.9rem; color:#c6c6cf}
.site-footer a{color:#ddd}

/* Modal */
.modal{
  position:fixed; inset:0; background:rgba(0,0,0,.6);
  display:none; align-items:center; justify-content:center; padding:16px;
}
.modal[aria-hidden="false"]{display:flex}
.modal-dialog{
  background:var(--panel); border:1px solid var(--border);
  border-radius:12px; padding:18px; max-width:720px; width:100%;
  box-shadow:0 10px 30px rgba(0,0,0,.5)
}
.modal-close{
  position:absolute; transform:translate(680px,-8px);
  background:#2b2b32; color:#fff; border:none; border-radius:999px; width:32px; height:32px; cursor:pointer;
}
.modal-body{line-height:1.5}
.modal-actions{display:flex; gap:10px; justify-content:flex-end; margin-top:14px}
.mt{margin-top:8px}
