import { test, expect } from "@playwright/test";

test.describe("WebAssembly Component Runner", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");

    // Wait for the app to initialize
    await expect(page.locator("h1")).toContainText("Component Model Loader");
    await expect(page.locator("#output")).toContainText(
      "WebAssembly Component Runner initialized",
    );
  });

  test("should load and run the add component", async ({ page }) => {
    // Click the "Load add.wasm" button
    await page.click("#loadAdd");

    // Wait for component to be loaded
    await expect(page.locator("#output")).toContainText(
      "Component loaded successfully",
    );
    await expect(page.locator("#componentInfo")).toContainText("add.wasm");

    // Check that transpile button is enabled
    const transpileBtn = page.locator("#transpileBtn");
    await expect(transpileBtn).toBeEnabled();

    // Click transpile button
    await transpileBtn.click();

    // Wait for transpilation to complete
    await expect(page.locator("#output")).toContainText(
      "Transpilation completed",
      { timeout: 30000 },
    );
    await expect(page.locator("#output")).toContainText(
      "Module loaded with exports",
    );
    await expect(page.locator("#output")).toContainText(
      "Component exports: add",
    );

    // Check that function call UI is visible
    await expect(page.locator("#functionCall")).toBeVisible();
    await expect(page.locator(".function-name")).toContainText("add");

    // Test calling the add function
    const argsInput = page.locator("#args-add");
    await argsInput.fill("[5, 3]");

    // Click the Call button for the add function
    await page.locator(".function-control button").click();

    // Check the result
    await expect(page.locator("#result-add")).toContainText("Result: 8");
    await expect(page.locator("#output")).toContainText("Calling add(5, 3)");
    await expect(page.locator("#output")).toContainText("Result: 8");

    // Test with different arguments
    await argsInput.clear();
    await argsInput.fill("[10, 25]");
    await page.locator(".function-control button").click();

    // Check the new result
    await expect(page.locator("#result-add")).toContainText("Result: 35");
    await expect(page.locator("#output")).toContainText("Calling add(10, 25)");
    await expect(page.locator("#output")).toContainText("Result: 35");
  });

  test("should load and run the string-reverse component", async ({ page }) => {
    // Click the "Load string-reverse.wasm" button
    await page.click("#loadStringReverse");

    // Wait for component to be loaded
    await expect(page.locator("#output")).toContainText(
      "Component loaded successfully",
    );
    await expect(page.locator("#componentInfo")).toContainText(
      "string-reverse.wasm",
    );

    // Click transpile button
    await page.locator("#transpileBtn").click();

    // Wait for transpilation to complete
    await expect(page.locator("#output")).toContainText(
      "Transpilation completed",
      { timeout: 30000 },
    );
    await expect(page.locator("#output")).toContainText(
      "Module loaded with exports",
    );

    // Check that function call UI is visible
    await expect(page.locator("#functionCall")).toBeVisible();

    // The function might be named 'reverse' or nested in a namespace
    // Let's be more flexible and find the actual input field
    const functionName = await page
      .locator(".function-name")
      .first()
      .textContent();
    console.log("Actual function name found:", functionName);

    // Find the corresponding input field - look for any args input
    const argsInput = page.locator('input[id^="args-"]').first();
    await argsInput.fill('["hello world"]');

    // Click the first Call button
    await page.locator(".function-control button").first().click();

    // Check the result - look for any result div
    const resultDiv = page.locator('div[id^="result-"]').first();
    await expect(resultDiv).toContainText('Result: "dlrow olleh"');
    await expect(page.locator("#output")).toContainText(
      'Result: "dlrow olleh"',
    );
  });

  test("should handle file upload", async ({ page }) => {
    // Get the path to the add.wasm file
    const filePath = "public/add.wasm";

    // Since the file input is hidden, we need to make it visible or click the label
    const [fileChooser] = await Promise.all([
      page.waitForEvent("filechooser"),
      page.click('label[for="fileInput"]'), // Click the label instead of the hidden input
    ]);

    await fileChooser.setFiles(filePath);

    // Wait for component to be loaded
    await expect(page.locator("#output")).toContainText(
      "Component loaded successfully",
    );
    await expect(page.locator("#componentInfo")).toContainText("add.wasm");
  });

  test("should clear output log", async ({ page }) => {
    // Add some log entries first
    await page.click("#loadAdd");
    await expect(page.locator("#output")).toContainText(
      "Component loaded successfully",
    );

    // Click clear button
    await page.click("#clearBtn");

    // Check that output was cleared and new message was added
    const logEntries = await page.locator(".log-entry").count();
    expect(logEntries).toBe(1); // Only "Output cleared" message
    await expect(page.locator("#output")).toContainText("Output cleared");
  });

  test("should display WIT information when available", async ({ page }) => {
    // Load a component
    await page.click("#loadAdd");

    // Wait for component to be loaded
    await expect(page.locator("#output")).toContainText(
      "Component loaded successfully",
    );

    // Check that WIT info section exists
    const witInfo = page.locator("#witInfo");
    await expect(witInfo).toBeVisible();

    // WIT extraction might succeed or fail, but the section should be there
    const witContent = await witInfo.textContent();
    expect(witContent).toBeTruthy();
  });

  test("should handle invalid function arguments gracefully", async ({
    page,
  }) => {
    // Load and transpile the add component
    await page.click("#loadAdd");
    await expect(page.locator("#output")).toContainText(
      "Component loaded successfully",
    );

    await page.locator("#transpileBtn").click();
    await expect(page.locator("#output")).toContainText(
      "Transpilation completed",
      { timeout: 30000 },
    );

    // Try calling with invalid arguments
    const argsInput = page.locator("#args-add");
    await argsInput.fill("not valid json");

    // Click the Call button
    await page.click('.function-control button[data-func="add"]');

    // Should treat it as a string argument and likely error
    await expect(page.locator("#output")).toContainText("Calling add");
  });

  test("should show correct status indicators", async ({ page }) => {
    const status = page.locator("#status");

    // Initial status
    await expect(status).toHaveText("No component loaded");
    await expect(status).toHaveClass(/status/);

    // Load a component
    await page.click("#loadAdd");

    // Status should update
    await expect(status).toHaveText("Component loaded");
    await expect(status).toHaveClass(/ready/);

    // During transpilation
    await page.locator("#transpileBtn").click();
    await expect(status).toHaveText("Transpiling...");
    await expect(status).toHaveClass(/loading/);

    // After transpilation
    await expect(status).toHaveText("Transpilation complete", {
      timeout: 30000,
    });
    await expect(status).toHaveClass(/ready/);
  });
});
