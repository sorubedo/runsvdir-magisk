# KernelSU Module WebUI

Source: https://kernelsu.org/guide/module-webui.html

## 概述

In addition to executing boot scripts and modifying system files, KernelSU modules can display user interfaces and interact directly with users.

Modules can define HTML + CSS + JavaScript pages with any web technology. KernelSU's manager displays these pages via WebView and exposes APIs for interacting with the system, such as executing shell commands.

## `webroot` directory

Web resource files should be placed in the `webroot` subdirectory of the module root directory, and there **MUST** be a file named `index.html`, which is the module page entry. The simplest module structure containing a web interface is as follows:

```
.
|-- module.prop
`-- webroot
    `-- index.html
```

> **WARNING**: When installing the module, KernelSU will automatically set the permissions and SELinux context for this directory. If you don't know what you're doing, do not set the permissions for this directory yourself!

If your page contains CSS and JavaScript, you need to place it in this directory as well.

## JavaScript API

If it's just a display page, it will function like a regular web page. However, KernelSU provides a series of system APIs, allowing implementation of module-specific functions.

KernelSU provides a JavaScript library, published on [npm](https://www.npmjs.com/package/kernelsu), which can be used in web pages.

Example - execute a shell command:

```javascript
import { exec } from 'kernelsu';

const { errno, stdout } = exec("getprop ro.product.model");
```

You can also make the page full screen or display a toast.

[API documentation on npm](https://www.npmjs.com/package/kernelsu)

## Tips

1. You can use `localStorage` as usual to store some data, but keep in mind that it will be lost if the manager app is uninstalled. If you need persistent storage, you will need to manually save the data in a specific directory.
2. For simple pages, we recommend using [parceljs](https://parceljs.org/) for packaging. It requires no initial configuration and is extremely easy to use.
