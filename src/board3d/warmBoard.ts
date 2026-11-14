let warming: Promise<void> | null = null;
/** Prepare the same versioned files the Godot loader will request. */
export const warmBoard = () => warming ??= (async () => {
 try {
  const response = await fetch('/godot/manifest.json', {cache:'no-cache'});
  if (!response.ok) return;
  const manifest: {assets:string[]} = await response.json();
  for (const url of manifest.assets) {
   const link = document.createElement('link');
   link.rel='preload'; link.as='fetch'; link.crossOrigin='anonymous'; link.href=url;
   document.head.append(link);
  }
 } catch { /* The normal loader retains its own retry and error reporting. */ }
})();
