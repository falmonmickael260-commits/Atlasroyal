"""Fetch only the Web template from the pinned official release archive."""
import hashlib
import io
import os
import pathlib
import urllib.request
import zipfile

VERSION = '4.6.3'
URL = f'https://github.com/godotengine/godot-builds/releases/download/{VERSION}-stable/Godot_v{VERSION}-stable_export_templates.tpz'
SIZE = 1255918323

class RemoteArchive(io.RawIOBase):
    def __init__(self):
        self.offset = 0
    def readable(self): return True
    def seekable(self): return True
    def tell(self): return self.offset
    def seek(self, offset, whence=0):
        self.offset = offset if whence == 0 else self.offset + offset if whence == 1 else SIZE + offset
        return self.offset
    def read(self, count=-1):
        if count < 0: count = SIZE-self.offset
        count = min(count, SIZE-self.offset)
        if not count: return b''
        if count>100_000_000: raise ValueError('Unexpected oversized archive read')
        end = self.offset+count-1
        request = urllib.request.Request(URL, headers={'Range':f'bytes={self.offset}-{end}','User-Agent':'FortuneEmpire-WebBuild'})
        with urllib.request.urlopen(request,timeout=120) as response:
            if response.status!=206: raise RuntimeError('Server must support byte ranges')
            data = response.read(count+1)
        if len(data)!=count: raise RuntimeError('Incomplete byte range')
        self.offset += count
        return data

def install():
    root = pathlib.Path(os.environ.get('XDG_DATA_HOME',str(pathlib.Path.home()/'.local/share')))
    target = root/'godot/export_templates'/f'{VERSION}.stable'
    target.mkdir(parents=True,exist_ok=True)
    with zipfile.ZipFile(RemoteArchive()) as archive:
        names = [name for name in archive.namelist() if 'web' in name]
        print('Official web templates:', names, flush=True)
        for name in names:
            if name.endswith('web_nothreads_release.zip'):
                data = archive.read(name)  # zipfile also verifies the archive CRC.
                if hashlib.sha256(data).hexdigest()!='1446f79dc12f60ce5d244c39fb6628ec298337ca5c4f91a16491feea72aa1bc9':
                    raise RuntimeError('Unexpected template checksum')
                (target/'web_nothreads_release.zip').write_bytes(data)
                print('Installed Web release template:',len(data),'bytes / sha256',hashlib.sha256(data).hexdigest(),flush=True)
                return
    raise RuntimeError('Expected non-threaded Web release template not found')

if __name__=='__main__': install()
