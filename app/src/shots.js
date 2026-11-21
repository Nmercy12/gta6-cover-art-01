// Fixed scenes for screenshots: ?shot=editor shows the page with a sample photo; ?shot=cover shows the cover alone.
// `photo` picks the sample (samples/<photo>.jpg) and `caption` the words. window.__shotReady is set once painted.
export async function runShot(shot, query, load) {
  if (shot === 'cover') {
    document.body.classList.add('shot-cover');
    const canvas = document.getElementById('cover');
    if (canvas) {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    }
  }
  const photoName = query.get('photo') ?? 'pier';
  const captionText = query.get('caption') ?? 'Sunset Heist';
  if (typeof load === 'function') {
    await load(`samples/${photoName}.jpg`, captionText);
  }
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      window.__shotReady = true;
    });
  });
}
