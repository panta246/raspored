const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('api', {
  auth: {
    check: (pin) => ipcRenderer.invoke('auth:check', pin),
    setPin: (pin) => ipcRenderer.invoke('auth:setPin', pin),
    hasPin: () => ipcRenderer.invoke('auth:hasPin'),
    generateRecoveryCodes: () => ipcRenderer.invoke('auth:generateRecoveryCodes'),
    recoveryStatus: () => ipcRenderer.invoke('auth:recoveryStatus'),
  },
  settings: {
    get: (k) => ipcRenderer.invoke('settings:get', k),
    set: (k, v) => ipcRenderer.invoke('settings:set', k, v),
  },
  skills: {
    list: () => ipcRenderer.invoke('skills:list'),
    add: (name) => ipcRenderer.invoke('skills:add', name),
    update: (id, name) => ipcRenderer.invoke('skills:update', id, name),
    remove: (id) => ipcRenderer.invoke('skills:delete', id),
  },
  workers: {
    list: () => ipcRenderer.invoke('workers:list'),
    add: (w) => ipcRenderer.invoke('workers:add', w),
    update: (w) => ipcRenderer.invoke('workers:update', w),
    remove: (id) => ipcRenderer.invoke('workers:delete', id),
  },
  locations: {
    list: () => ipcRenderer.invoke('locations:list'),
    add: (l) => ipcRenderer.invoke('locations:add', l),
    update: (l) => ipcRenderer.invoke('locations:update', l),
    remove: (id) => ipcRenderer.invoke('locations:delete', id),
  },
  schedule: {
    generate: (start, days) => ipcRenderer.invoke('schedule:generate', start, days),
    get: (start, end) => ipcRenderer.invoke('schedule:get', start, end),
    setManual: (date, shift, loc, worker) => ipcRenderer.invoke('schedule:setManual', date, shift, loc, worker),
    remove: (date, shift, loc, worker) => ipcRenderer.invoke('schedule:remove', date, shift, loc, worker),
    available: (date, shift) => ipcRenderer.invoke('schedule:available', date, shift),
  },
  orders: {
    get: (date, worker) => ipcRenderer.invoke('orders:get', date, worker),
    set: (date, worker, text) => ipcRenderer.invoke('orders:set', date, worker, text),
    forDate: (date) => ipcRenderer.invoke('orders:forDate', date),
  },
  pdf: {
    export: (html, name) => ipcRenderer.invoke('pdf:export', html, name),
  },
});
