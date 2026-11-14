"""Brand the generated Godot loader without changing its engine bootstrap."""
from pathlib import Path
root = Path(__file__).resolve().parents[1]/'build'
page = root/'index.html'
html = page.read_text()
html = html.replace('<html lang="en">','<html lang="fr">')
css = '''<style>
body,#status{background:#091e25;color:#f1eadb}
#status-splash{display:none!important}
#status-brand{font-family:Georgia,serif;text-align:center;color:#d6b982;letter-spacing:.08em;font-size:clamp(24px,5vw,48px)}
#status-brand small{display:block;color:#93aba6;font:12px Arial,sans-serif;letter-spacing:.2em;margin-top:18px}
#status-progress{accent-color:#d6b982;bottom:30%;max-width:300px;height:5px}
#status-notice{background:#153139;border-color:#69745d;color:#f1eadb;font:15px/1.5 Arial,sans-serif}
</style>'''
html = html.replace('</head>',css+'</head>')
html = html.replace('const engine = new Engine(GODOT_CONFIG);',"if (new URLSearchParams(location.search).get('renderer') === '1') GODOT_CONFIG.focusCanvas = false;\nconst engine = new Engine(GODOT_CONFIG);")
html = html.replace('<div id="status">','<div id="status"><div id="status-brand">FORTUNE EMPIRE<small>VOTRE TABLE SE PRÉPARE…</small></div>')
html = html.replace('Your browser does not support the canvas tag.','Votre navigateur ne prend pas en charge cet affichage.')
html = html.replace('Your browser does not support JavaScript.','Activez JavaScript pour lancer Fortune Empire.')
page.write_text(html)
