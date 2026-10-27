import { contextBridge, ipcRenderer } from 'electron';
import type { StudioBridge } from '../src/shared/schema';
const bridge: StudioBridge = {
  bootstrap: () => ipcRenderer.invoke('studio:bootstrap'),
  saveProject: (p, saveAs) => ipcRenderer.invoke('studio:save', p, saveAs),
  openProject: id => ipcRenderer.invoke('studio:open', id),
  releaseProject: () => ipcRenderer.invoke('studio:release-project'),
  recovery: p => ipcRenderer.invoke('studio:recovery', p),
  settings: s => ipcRenderer.invoke('studio:settings', s),
  importSamples: folder => ipcRenderer.invoke('studio:import', folder),
  updateSample: sample => ipcRenderer.invoke('studio:sample', sample),
  relinkSample: id => ipcRenderer.invoke('studio:relink', id),
  scanSamples: () => ipcRenderer.invoke('studio:scan'),
  readyToClose: () => ipcRenderer.send('studio:close-ready'),
  onClose: callback => { const listener = () => callback(); ipcRenderer.on('studio:close-request', listener); return () => ipcRenderer.removeListener('studio:close-request', listener); },
  onMenu: callback => { const listener = (_e: unknown, command: string) => callback(command); ipcRenderer.on('studio:menu', listener); return () => ipcRenderer.removeListener('studio:menu', listener); }
};
contextBridge.exposeInMainWorld('studio', bridge);
