import "./style.css";
import { transpile } from "@bytecodealliance/jco";

const app = document.querySelector("#app");

app.innerHTML = `
  <div>
    <h1>Component Model Loader</h1>
    <p class="subtitle">Load and run WebAssembly components</p>
    
    <div class="container">
      <div class="panel full-width">
        <h2>Step 1: Load Component</h2>
        <div class="file-input-wrapper" id="dropZone">
          <input type="file" id="fileInput" accept=".wasm" />
          <label for="fileInput" class="file-label">
            📁 Click to select or drag & drop a .wasm file
          </label>
          <div class="file-info">Or try one of the example components:</div>
          <div style="margin-top: 10px;">
            <button class="secondary" id="loadStringReverse">Load string-reverse.wasm</button>
            <button class="secondary" id="loadAdd">Load add.wasm</button>
          </div>
        </div>
      </div>

      <div class="panel">
        <h2>Component Info</h2>
        <div id="componentInfo">
          <p style="color: #999;">No component loaded</p>
        </div>
      </div>

      <div class="panel">
        <h2>WIT Interface</h2>
        <div id="witInfo">
          <pre style="color: #999;">No WIT information available</pre>
        </div>
      </div>

      <div class="panel full-width">
        <h2>Controls</h2>
        <div class="controls">
          <button id="transpileBtn" disabled>Transpile Component</button>
          <button id="runBtn" disabled>Run Component</button>
          <button class="secondary" id="clearBtn">Clear Output</button>
          <span id="status" class="status">No component loaded</span>
        </div>
        <div id="functionCall" style="display: none;">
          <h3>Call Exported Functions</h3>
          <div id="functionControls"></div>
        </div>
      </div>

      <div class="panel full-width">
        <h2>Output Log</h2>
        <div id="output"></div>
      </div>
    </div>
  </div>
`;

let componentBytes = null;
let transpiledModule = null;
let componentExports = {};

const fileInput = document.getElementById("fileInput") as HTMLInputElement;
const dropZone = document.getElementById("dropZone");
const transpileBtn = document.getElementById(
  "transpileBtn",
) as HTMLButtonElement;
const runBtn = document.getElementById("runBtn") as HTMLButtonElement;
const clearBtn = document.getElementById("clearBtn");
const output = document.getElementById("output");
const status = document.getElementById("status");
const componentInfo = document.getElementById("componentInfo");
const witInfo = document.getElementById("witInfo");
const functionCall = document.getElementById("functionCall");
const functionControls = document.getElementById("functionControls");
const loadStringReverse = document.getElementById("loadStringReverse");
const loadAdd = document.getElementById("loadAdd");

function log(message, type = "info") {
  const entry = document.createElement("div");
  entry.className = `log-entry ${type}`;
  const timestamp = new Date().toLocaleTimeString();
  entry.textContent = `[${timestamp}] ${message}`;
  output.appendChild(entry);
  output.scrollTop = output.scrollHeight;
}

function updateStatus(text, type = "ready") {
  status.textContent = text;
  status.className = `status ${type}`;
}

async function loadComponent(bytes, filename) {
  try {
    log(`Loading component: ${filename}`, "info");
    updateStatus("Loading component...", "loading");

    componentBytes = bytes;

    // WIT extraction is not available in browser build
    witInfo.innerHTML = `<pre style="color: #999;">WIT extraction not available in browser environment</pre>`;

    componentInfo.innerHTML = `
      <div class="info-grid">
        <div class="info-label">File:</div>
        <div class="info-value">${filename}</div>
        <div class="info-label">Size:</div>
        <div class="info-value">${(bytes.length / 1024).toFixed(2)} KB</div>
        <div class="info-label">Type:</div>
        <div class="info-value">WebAssembly Component</div>
      </div>
    `;

    transpileBtn.disabled = false;
    updateStatus("Component loaded", "ready");
    log(
      `Component loaded successfully (${(bytes.length / 1024).toFixed(2)} KB)`,
      "success",
    );
  } catch (error) {
    log(`Error loading component: ${error.message}`, "error");
    updateStatus("Error loading component", "error");
  }
}

fileInput.addEventListener("change", async (e) => {
  const file = (e.target as HTMLInputElement).files?.[0];
  if (!file) return;

  const bytes = new Uint8Array(await file.arrayBuffer());
  await loadComponent(bytes, file.name);
});

// Drag and drop support
dropZone.addEventListener("dragover", (e) => {
  e.preventDefault();
  dropZone.classList.add("drag-over");
});

dropZone.addEventListener("dragleave", () => {
  dropZone.classList.remove("drag-over");
});

dropZone.addEventListener("drop", async (e) => {
  e.preventDefault();
  dropZone.classList.remove("drag-over");

  const file = e.dataTransfer.files[0];
  if (file && file.name.endsWith(".wasm")) {
    const bytes = new Uint8Array(await file.arrayBuffer());
    await loadComponent(bytes, file.name);
  }
});

// Load example components
loadStringReverse.addEventListener("click", async () => {
  try {
    const response = await fetch(
      new URL("/string-reverse.wasm", import.meta.url).href,
    );
    if (!response.ok) {
      throw new Error(`Failed to load example component (${response.status})`);
    }
    const bytes = new Uint8Array(await response.arrayBuffer());
    await loadComponent(bytes, "string-reverse.wasm");
  } catch (error) {
    log(`Failed to load example component: ${error.message}`, "error");
    log("Make sure the example file exists in the public directory", "info");
  }
});

loadAdd.addEventListener("click", async () => {
  try {
    const response = await fetch(new URL("/add.wasm", import.meta.url).href);
    if (!response.ok) {
      throw new Error(`Failed to load example component (${response.status})`);
    }
    const bytes = new Uint8Array(await response.arrayBuffer());
    await loadComponent(bytes, "add.wasm");
  } catch (error) {
    log(`Failed to load example component: ${error.message}`, "error");
    log("Make sure the example file exists in the public directory", "info");
  }
});

transpileBtn.addEventListener("click", async () => {
  try {
    log("Starting transpilation...", "info");
    updateStatus("Transpiling...", "loading");
    transpileBtn.disabled = true;

    const startTime = performance.now();
    const result = await transpile(componentBytes, {
      name: "component",
      // @ts-ignore - noTypescript option exists but not in type definitions
      noTypescript: true,
      validLiftingOptimization: false,
    });
    const elapsed = ((performance.now() - startTime) / 1000).toFixed(2);

    log(`Transpilation completed in ${elapsed}s`, "success");

    // Files is an array of tuples: Array<[string, Uint8Array]>
    const filesArray = result.files as any;

    // Convert to object for easier access
    const files: any = {};
    for (const [filename, content] of filesArray) {
      files[filename] = content;
    }

    log(
      `Generated files: ${filesArray.map(([name]: [string, any]) => name).join(", ")}`,
      "info",
    );

    // Also log the exports that were found
    if (result.exports && result.exports.length > 0) {
      log(
        `Component exports: ${result.exports.map(([name]) => name).join(", ")}`,
        "info",
      );
    }

    // Verify component.js was generated
    const jsFile = files["component.js"];
    if (!jsFile) {
      throw new Error("No JavaScript file was generated from the component");
    }

    // Create blob URLs for the transpiled files
    const imports = {};

    for (const [filename, content] of Object.entries(files)) {
      if (filename.endsWith(".wasm")) {
        const blob = new Blob([content as BlobPart], {
          type: "application/wasm",
        });
        const url = URL.createObjectURL(blob);
        imports[`./${filename}`] = url;
        log(`Created blob URL for ${filename}`, "info");
      }
    }

    // Handle the main JS file - it should be a Uint8Array
    const jsFileContent = files["component.js"];
    if (!jsFileContent) {
      throw new Error("No component.js file generated");
    }

    let jsContent = new TextDecoder().decode(jsFileContent);

    // Replace imports to use blob URLs
    for (const [importPath, blobUrl] of Object.entries(imports)) {
      const importName = importPath.replace("./", "");
      // Replace static imports
      jsContent = jsContent.replace(
        new RegExp(`from\\s+['"]\\./?(${importName})['"]`, "g"),
        `from '${blobUrl}'`,
      );
      // Replace dynamic imports
      jsContent = jsContent.replace(
        new RegExp(`import\\s*\\(['"]\\./?(${importName})['"]\\)`, "g"),
        `import('${blobUrl}')`,
      );
      // Replace URL constructor calls
      jsContent = jsContent.replace(
        new RegExp(
          `new\\s+URL\\s*\\(['"]\\./?(${importName})['"],\\s*import\\.meta\\.url\\s*\\)`,
          "g",
        ),
        `new URL('${blobUrl}')`,
      );
    }

    // Create a blob URL for the JS module
    const jsBlob = new Blob([jsContent], { type: "application/javascript" });
    const jsUrl = URL.createObjectURL(jsBlob);

    // Import the transpiled module
    log("Loading transpiled module...", "info");
    transpiledModule = await import(/* @vite-ignore */ jsUrl);

    componentExports = transpiledModule;
    const exportKeys = Object.keys(transpiledModule);
    if (exportKeys.length > 0) {
      log(`Module loaded with exports: ${exportKeys.join(", ")}`, "success");

      // Debug: Log the actual export structure
      console.log("Debug - Module exports:", transpiledModule);
      exportKeys.forEach((key) => {
        console.log(
          `Export "${key}":`,
          typeof transpiledModule[key],
          transpiledModule[key],
        );
      });
    } else {
      log(`Module loaded (checking for default export)`, "info");
      // Check if there's a default export or the module itself is a function
      if (transpiledModule.default) {
        componentExports = transpiledModule.default;
        log(
          `Using default export with keys: ${Object.keys(componentExports).join(", ")}`,
          "success",
        );
      }
    }

    // Setup function call UI
    setupFunctionCalls();

    runBtn.disabled = false;
    updateStatus("Transpilation complete", "ready");
  } catch (error) {
    const errorMsg = error.message || "Unknown error occurred";
    log(`Transpilation failed: ${errorMsg}`, "error");

    // Provide helpful error messages
    if (errorMsg.includes("WebAssembly")) {
      log("Make sure the file is a valid WebAssembly component", "error");
    } else if (errorMsg.includes("memory")) {
      log("The component might be too large for browser memory", "error");
    }

    updateStatus("Transpilation failed", "error");
  } finally {
    transpileBtn.disabled = false;
  }
});

// Recursively find all callable functions in an object
function findCallableFunctions(obj, path = "", visited = new WeakSet()) {
  const functions = [];

  // Prevent infinite recursion with circular references
  if (visited.has(obj)) {
    return functions;
  }
  if (typeof obj === "object" && obj !== null) {
    visited.add(obj);
  }

  for (const key in obj) {
    // Skip prototype properties and certain built-in properties
    // Use Object.prototype.hasOwnProperty.call to handle objects without hasOwnProperty
    if (
      !Object.prototype.hasOwnProperty.call(obj, key) ||
      key === "constructor" ||
      key === "__proto__"
    ) {
      continue;
    }

    try {
      const value = obj[key];
      const currentPath = path ? `${path}.${key}` : key;

      if (typeof value === "function") {
        // Extract a simple display name from the path
        // For paths like "example:string-reverse/reverse@0.1.0.reverse", use just "reverse"
        let displayName = key;
        if (key.includes("/")) {
          // Handle namespaced exports like "example:string-reverse/reverse@0.1.0"
          const parts = key.split("/");
          displayName = parts[parts.length - 1].split("@")[0];
        }

        functions.push({
          path: currentPath,
          displayName: displayName,
          func: value,
          getter: () => {
            // Create a getter function that navigates the path
            const current = obj;
            return current[key];
          },
        });
      } else if (
        typeof value === "object" &&
        value !== null &&
        !Array.isArray(value)
      ) {
        // Recursively check nested objects
        const nestedFunctions = findCallableFunctions(
          value,
          currentPath,
          visited,
        );
        functions.push(...nestedFunctions);
      }
    } catch (e) {
      // Some properties might throw on access, skip them
      console.warn(`Could not access property "${key}":`, e);
    }
  }

  return functions;
}

function setupFunctionCalls() {
  functionControls.innerHTML = "";

  console.log(
    "Setting up function calls for component exports:",
    componentExports,
  );

  // Recursively find all callable functions
  const functionsFound = findCallableFunctions(componentExports);

  console.log(
    `Found ${functionsFound.length} callable function(s):`,
    functionsFound.map((f) => f.path),
  );

  if (functionsFound.length > 0) {
    functionCall.style.display = "block";
    log("Setting up function call UI...", "info");

    // Store function references for easy access
    (window as any).__componentFunctions = {};

    // Create UI for each function
    functionsFound.forEach(({ path, displayName, func }) => {
      // Create a safe ID for HTML elements
      const safeName = path.replace(/[^a-zA-Z0-9]/g, "_");

      // Store the function reference
      (window as any).__componentFunctions[safeName] = func;

      const control = document.createElement("div");
      control.className = "function-control";
      control.innerHTML = `
        <div class="function-name">${displayName}</div>
        <div class="function-inputs">
          <input type="text" id="args-${safeName}" placeholder="Arguments (JSON array, e.g., [1, 2])" />
          <button data-func="${safeName}" data-display-name="${displayName}">Call</button>
        </div>
        <div id="result-${safeName}" class="function-result" style="display: none;"></div>
      `;
      functionControls.appendChild(control);

      const button = control.querySelector("button");
      button.addEventListener("click", () =>
        callFunctionBySafeName(safeName, displayName),
      );
    });

    log(`Created UI for ${functionsFound.length} function(s)`, "success");

    // Log the actual function names for debugging
    const functionNames = functionsFound.map((f) => f.displayName);
    log(`Available functions: ${functionNames.join(", ")}`, "info");
  } else {
    log("No callable functions found in the component exports", "warning");
    functionCall.style.display = "none";
  }
}

async function callFunctionBySafeName(safeName, displayName) {
  try {
    const argsInput = document.getElementById(
      `args-${safeName}`,
    ) as HTMLInputElement;
    const resultDiv = document.getElementById(`result-${safeName}`);

    let args = [];
    if (argsInput.value) {
      try {
        args = JSON.parse(argsInput.value);
        if (!Array.isArray(args)) {
          args = [args];
        }
      } catch {
        // Try treating it as a single string argument
        args = [argsInput.value];
      }
    }

    // Get the function from our stored references
    const func = (window as any).__componentFunctions[safeName];
    if (!func) {
      throw new Error(`Function not found: ${displayName}`);
    }

    log(
      `Calling ${displayName}(${args.map((a) => JSON.stringify(a)).join(", ")})`,
      "info",
    );
    const result = await func(...args);

    resultDiv.style.display = "block";
    resultDiv.textContent = `Result: ${JSON.stringify(result)}`;
    log(`Result: ${JSON.stringify(result)}`, "success");
  } catch (error) {
    log(`Error calling ${displayName}: ${error.message}`, "error");
  }
}

runBtn.addEventListener("click", async () => {
  try {
    log("Attempting to run component...", "info");

    // Check for common entry points
    if ((componentExports as any).run) {
      log('Found "run" export, executing...', "info");
      const result = await (componentExports as any).run();
      log(`Run completed: ${JSON.stringify(result)}`, "success");
    } else if ((componentExports as any).main) {
      log('Found "main" export, executing...', "info");
      const result = await (componentExports as any).main();
      log(`Main completed: ${JSON.stringify(result)}`, "success");
    } else if ((componentExports as any).start) {
      log('Found "start" export, executing...', "info");
      const result = await (componentExports as any).start();
      log(`Start completed: ${JSON.stringify(result)}`, "success");
    } else {
      log(
        "No standard entry point found. Use the function call interface to call specific exports.",
        "warning",
      );
    }
  } catch (error) {
    log(`Execution error: ${error.message}`, "error");
    console.error(error);
  }
});

clearBtn.addEventListener("click", () => {
  output.innerHTML = "";
  log("Output cleared", "info");
});

// Initial log
log("WebAssembly Component Runner initialized", "success");
log("Select a .wasm component file or load an example to begin", "info");
