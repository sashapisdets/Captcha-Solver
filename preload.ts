// Copyright (c) 2021 MillenniumEarl
// 
// This software is released under the MIT License.
// https://opensource.org/licenses/MIT

import { contextBridge, ipcRenderer } from "electron";

// Expose protected methods that allow the renderer process to use
// the ipcRenderer without exposing the entire object
contextBridge.exposeInMainWorld(
    "api", {
        send: (channel: string, data: any) => {
            // whitelist channels
            let validChannels = ["sendCaptcha"];
            if (validChannels.includes(channel)) {
                ipcRenderer.send(channel, data);
            }
        }
    }
);