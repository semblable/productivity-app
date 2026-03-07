export async function getServiceWorkerTarget() {
  if (!('serviceWorker' in navigator)) {
    return null;
  }

  const registration = await navigator.serviceWorker.ready.catch(() => null);
  return (
    navigator.serviceWorker.controller ||
    registration?.active ||
    registration?.waiting ||
    registration?.installing ||
    null
  );
}

export async function postServiceWorkerCommand(command, data) {
  const target = await getServiceWorkerTarget();
  if (!target) {
    return false;
  }

  target.postMessage({ command, data });
  return true;
}
