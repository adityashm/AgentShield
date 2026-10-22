import json,os,urllib.request,sys

# Path to the screens content produced by the MCP call
content_path = r"c:\Users\aditya\AppData\Roaming\Code\User\workspaceStorage\cc2bcdc15340794d6d7fdd87e73cdf33\GitHub.copilot-chat\chat-session-resources\6777357c-8656-464b-9e9b-b6fec8f749d9\call_KfuWjfdKwe3IqSxQWbH0hXHj__vscode-1780488674406\content.json"
if not os.path.exists(content_path):
    print('ERROR: content.json not found at', content_path)
    sys.exit(1)

with open(content_path,'r',encoding='utf-8') as f:
    data = json.load(f)

screens = data.get('screens', [])
output_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', 'stitch_downloads'))
if not os.path.exists(output_dir):
    os.makedirs(output_dir)

def safe_name(s):
    return ''.join(c if c.isalnum() or c in '-_.' else '_' for c in s)[:200]

for i, s in enumerate(screens):
    title = s.get('title') or s.get('name') or f'screen_{i}'
    base = safe_name(title)
    # download htmlCode if present
    html = s.get('htmlCode', {})
    if html and 'downloadUrl' in html:
        url = html['downloadUrl']
        ext = '.html'
        fname = f"{i:03d}_{base}{ext}"
        outpath = os.path.join(output_dir, fname)
        try:
            print('Downloading HTML:', url, '->', outpath)
            urllib.request.urlretrieve(url, outpath)
        except Exception as e:
            print('Failed to download HTML for', title, e)
    # download screenshot if present
    ss = s.get('screenshot', {})
    if ss and 'downloadUrl' in ss and ss['downloadUrl']:
        url = ss['downloadUrl']
        # try to guess extension
        ext = os.path.splitext(url.split('?')[0])[1]
        if not ext:
            ext = '.png'
        fname = f"{i:03d}_{base}_screenshot{ext}"
        outpath = os.path.join(output_dir, fname)
        try:
            print('Downloading Screenshot:', url, '->', outpath)
            urllib.request.urlretrieve(url, outpath)
        except Exception as e:
            print('Failed to download screenshot for', title, e)

print('Done. Files saved to', output_dir)
