import zipfile, xml.etree.ElementTree as ET, sys
path = r"c:\Users\aditya\Downloads\AgentShield\AgentShield_AI_SRS_v1.0.docx"
try:
    with zipfile.ZipFile(path) as z:
        xml = z.read('word/document.xml')
    root = ET.fromstring(xml)
    ns = {'w':'http://schemas.openxmlformats.org/wordprocessingml/2006/main'}
    texts = [t.text for t in root.findall('.//w:t', ns) if t.text]
    out = '\n'.join(texts)
    print(out)
except Exception as e:
    print("ERROR:", e, file=sys.stderr)
    sys.exit(1)
